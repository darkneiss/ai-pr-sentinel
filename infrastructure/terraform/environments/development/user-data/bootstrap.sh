#!/bin/sh
# Lightsail prepends its own cloud-init script with /bin/sh, so keep this script POSIX-compatible.
set -eux

DEPLOY_USER="${DEPLOY_USER}"
DEPLOY_SSH_PUBLIC_KEY_B64="${DEPLOY_SSH_PUBLIC_KEY_B64}"
DEPLOY_ENABLE_ROOTLESS_DOCKER="${DEPLOY_ENABLE_ROOTLESS_DOCKER}"
DEPLOY_HOME="/srv/$${DEPLOY_USER}"

if [ -z "$DEPLOY_USER" ]; then
  echo "Bootstrap error: DEPLOY_USER is empty." >&2
  exit 1
fi

if [ -z "$DEPLOY_SSH_PUBLIC_KEY_B64" ]; then
  echo "Bootstrap error: DEPLOY_SSH_PUBLIC_KEY_B64 is empty." >&2
  exit 1
fi

apt-get update -y
apt-get upgrade -y

apt-get install -y ca-certificates curl gnupg lsb-release ufw uidmap dbus-user-session slirp4netns fuse-overlayfs

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable docker
systemctl start docker

install -d -m 0755 /srv

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd --create-home --home-dir "$DEPLOY_HOME" --shell /bin/bash "$DEPLOY_USER"
else
  CURRENT_HOME="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
  if [ "$CURRENT_HOME" != "$DEPLOY_HOME" ]; then
    if ! usermod --home "$DEPLOY_HOME" --move-home "$DEPLOY_USER"; then
      usermod --home "$DEPLOY_HOME" "$DEPLOY_USER"
      install -d -m 0750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$DEPLOY_HOME"
    fi
  fi
fi

passwd -l "$DEPLOY_USER"
gpasswd -d "$DEPLOY_USER" sudo || true

install -d -m 0700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$DEPLOY_HOME/.ssh"
printf '%s' "$DEPLOY_SSH_PUBLIC_KEY_B64" | base64 -d > "$DEPLOY_HOME/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_HOME/.ssh/authorized_keys"
chmod 0600 "$DEPLOY_HOME/.ssh/authorized_keys"

cat > /etc/ssh/sshd_config.d/60-deploy-user.conf <<EOF
Match User $DEPLOY_USER
  PasswordAuthentication no
  KbdInteractiveAuthentication no
  PubkeyAuthentication yes
  AuthenticationMethods publickey
EOF

systemctl restart ssh || systemctl restart sshd

if [ "$DEPLOY_ENABLE_ROOTLESS_DOCKER" = "true" ]; then
  cat > /etc/sysctl.d/99-rootless-docker-ports.conf <<EOF
net.ipv4.ip_unprivileged_port_start=80
EOF
  sysctl --system

  gpasswd -d "$DEPLOY_USER" docker || true

  if su - "$DEPLOY_USER" -c "dockerd-rootless-setuptool.sh install"; then
    loginctl enable-linger "$DEPLOY_USER" || true

    DEPLOY_UID="$(id -u "$DEPLOY_USER")"
    DEPLOY_PROFILE="$DEPLOY_HOME/.profile"
    DEPLOY_DOCKER_HOST="unix:///run/user/$${DEPLOY_UID}/docker.sock"

    if ! grep -q "DOCKER_HOST=$${DEPLOY_DOCKER_HOST}" "$DEPLOY_PROFILE"; then
      cat >> "$DEPLOY_PROFILE" <<EOF

export DOCKER_HOST=$${DEPLOY_DOCKER_HOST}
EOF
      chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_PROFILE"
    fi
  else
    echo "WARNING: rootless Docker setup failed; adding '$DEPLOY_USER' to docker group (less secure)." >&2
    usermod -aG docker "$DEPLOY_USER"
  fi
else
  echo "WARNING: rootless Docker disabled; adding '$DEPLOY_USER' to docker group (less secure)." >&2
  usermod -aG docker "$DEPLOY_USER"
fi

ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
