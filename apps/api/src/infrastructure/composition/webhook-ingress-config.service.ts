import type { ConfigPort } from '../../shared/application/ports/config.port';

const ALLOWED_REPOSITORIES_ENV_VAR = 'SCM_WEBHOOK_ALLOWED_REPOSITORIES';
const STRICT_REPOSITORY_ALLOWLIST_ENV_VAR = 'SCM_WEBHOOK_STRICT_REPOSITORY_ALLOWLIST';
const REQUIRE_DELIVERY_ID_ENV_VAR = 'SCM_WEBHOOK_REQUIRE_DELIVERY_ID';
const DELIVERY_TTL_SECONDS_ENV_VAR = 'SCM_WEBHOOK_DELIVERY_TTL_SECONDS';
const LEGACY_ALLOWED_REPOSITORIES_ENV_VAR = 'GITHUB_WEBHOOK_ALLOWED_REPOSITORIES';
const LEGACY_STRICT_REPOSITORY_ALLOWLIST_ENV_VAR = 'GITHUB_WEBHOOK_STRICT_REPOSITORY_ALLOWLIST';
const LEGACY_REQUIRE_DELIVERY_ID_ENV_VAR = 'GITHUB_WEBHOOK_REQUIRE_DELIVERY_ID';
const LEGACY_DELIVERY_TTL_SECONDS_ENV_VAR = 'GITHUB_WEBHOOK_DELIVERY_TTL_SECONDS';

const DEFAULT_DELIVERY_TTL_SECONDS = 60 * 60 * 24;
const MIN_DELIVERY_TTL_SECONDS = 1;
const POSITIVE_INTEGER_PATTERN = /^\d+$/;
const LEGACY_ENV_VAR_ERROR_MESSAGE =
  'Legacy env var %LEGACY_ENV_VAR% is no longer supported. Use %SCM_ENV_VAR%.';

interface LegacyEnvAlias {
  scmEnvVar: string;
  legacyEnvVar: string;
}

const LEGACY_INGRESS_ENV_ALIASES: readonly LegacyEnvAlias[] = [
  {
    scmEnvVar: ALLOWED_REPOSITORIES_ENV_VAR,
    legacyEnvVar: LEGACY_ALLOWED_REPOSITORIES_ENV_VAR,
  },
  {
    scmEnvVar: STRICT_REPOSITORY_ALLOWLIST_ENV_VAR,
    legacyEnvVar: LEGACY_STRICT_REPOSITORY_ALLOWLIST_ENV_VAR,
  },
  {
    scmEnvVar: REQUIRE_DELIVERY_ID_ENV_VAR,
    legacyEnvVar: LEGACY_REQUIRE_DELIVERY_ID_ENV_VAR,
  },
  {
    scmEnvVar: DELIVERY_TTL_SECONDS_ENV_VAR,
    legacyEnvVar: LEGACY_DELIVERY_TTL_SECONDS_ENV_VAR,
  },
];

const hasConfiguredEnvValue = (value: string | undefined): boolean =>
  typeof value === 'string' && value.trim().length > 0;

const throwLegacyEnvVarError = (legacyEnvVar: string, scmEnvVar: string): never => {
  throw new Error(
    LEGACY_ENV_VAR_ERROR_MESSAGE.replace('%LEGACY_ENV_VAR%', legacyEnvVar).replace(
      '%SCM_ENV_VAR%',
      scmEnvVar,
    ),
  );
};

const validateNoLegacyIngressEnvVars = (config: ConfigPort): void => {
  for (const alias of LEGACY_INGRESS_ENV_ALIASES) {
    const scmValue = config.get(alias.scmEnvVar);
    const legacyValue = config.get(alias.legacyEnvVar);

    if (hasConfiguredEnvValue(legacyValue) && !hasConfiguredEnvValue(scmValue)) {
      throwLegacyEnvVarError(alias.legacyEnvVar, alias.scmEnvVar);
    }
  }
};

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

  const normalizedValue = value.trim();
  if (!POSITIVE_INTEGER_PATTERN.test(normalizedValue)) {
    return undefined;
  }

  const parsedValue = Number(normalizedValue);
  if (!Number.isInteger(parsedValue) || parsedValue < MIN_DELIVERY_TTL_SECONDS) {
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
  validateNoLegacyIngressEnvVars(config);

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
