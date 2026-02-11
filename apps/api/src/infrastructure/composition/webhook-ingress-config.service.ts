import type { ConfigPort } from '../../shared/application/ports/config.port';

const ALLOWED_REPOSITORIES_ENV_VAR = 'GITHUB_WEBHOOK_ALLOWED_REPOSITORIES';
const STRICT_REPOSITORY_ALLOWLIST_ENV_VAR = 'GITHUB_WEBHOOK_STRICT_REPOSITORY_ALLOWLIST';
const REQUIRE_DELIVERY_ID_ENV_VAR = 'GITHUB_WEBHOOK_REQUIRE_DELIVERY_ID';
const DELIVERY_TTL_SECONDS_ENV_VAR = 'GITHUB_WEBHOOK_DELIVERY_TTL_SECONDS';

const DEFAULT_DELIVERY_TTL_SECONDS = 60 * 60 * 24;
const MIN_DELIVERY_TTL_SECONDS = 1;

const parseAllowedRepositories = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((repositoryFullName) => repositoryFullName.trim())
    .filter((repositoryFullName) => repositoryFullName.length > 0);
};

const parsePositiveInteger = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isFinite(parsedValue) || parsedValue < MIN_DELIVERY_TTL_SECONDS) {
    return undefined;
  }

  return parsedValue;
};

export interface WebhookIngressConfig {
  allowedRepositories: string[];
  strictRepositoryAllowlist: boolean;
  requireDeliveryId: boolean;
  deliveryTtlSeconds: number;
}

export const resolveWebhookIngressConfig = (config: ConfigPort): WebhookIngressConfig => {
  const allowedRepositories = parseAllowedRepositories(config.get(ALLOWED_REPOSITORIES_ENV_VAR));
  const strictRepositoryAllowlist = config.getBoolean(STRICT_REPOSITORY_ALLOWLIST_ENV_VAR) ?? false;
  const requireDeliveryId = config.getBoolean(REQUIRE_DELIVERY_ID_ENV_VAR) ?? false;
  const deliveryTtlSeconds =
    parsePositiveInteger(config.get(DELIVERY_TTL_SECONDS_ENV_VAR)) ?? DEFAULT_DELIVERY_TTL_SECONDS;

  return {
    allowedRepositories,
    strictRepositoryAllowlist,
    requireDeliveryId,
    deliveryTtlSeconds,
  };
};
