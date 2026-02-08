import type { ConfigPort } from '../../shared/application/ports/config.port';

const GITHUB_WEBHOOK_SECRET_ENV_VAR = 'GITHUB_WEBHOOK_SECRET';
const GITHUB_WEBHOOK_VERIFY_SIGNATURE_ENV_VAR = 'GITHUB_WEBHOOK_VERIFY_SIGNATURE';
const NODE_ENV_ENV_VAR = 'NODE_ENV';
const PRODUCTION_NODE_ENV = 'production';

const shouldVerifyWebhookSignature = (config: ConfigPort): boolean => {
  const explicitVerifySignature = config.getBoolean(GITHUB_WEBHOOK_VERIFY_SIGNATURE_ENV_VAR);
  if (explicitVerifySignature !== undefined) {
    return explicitVerifySignature;
  }

  if (config.get(NODE_ENV_ENV_VAR) === PRODUCTION_NODE_ENV) {
    return true;
  }

  const webhookSecret = config.get(GITHUB_WEBHOOK_SECRET_ENV_VAR);
  return typeof webhookSecret === 'string' && webhookSecret.length > 0;
};

export interface WebhookSignatureConfig {
  verifyWebhookSignature: boolean;
  webhookSecret?: string;
}

export const resolveWebhookSignatureConfig = (config: ConfigPort): WebhookSignatureConfig => {
  const verifyWebhookSignature = shouldVerifyWebhookSignature(config);
  const webhookSecret = config.get(GITHUB_WEBHOOK_SECRET_ENV_VAR);

  if (verifyWebhookSignature && (!webhookSecret || webhookSecret.length === 0)) {
    throw new Error(
      `Missing ${GITHUB_WEBHOOK_SECRET_ENV_VAR} while ${GITHUB_WEBHOOK_VERIFY_SIGNATURE_ENV_VAR}=true`,
    );
  }

  return {
    verifyWebhookSignature,
    webhookSecret,
  };
};
