import type { ConfigPort } from '../../shared/application/ports/config.port';

const ALLOWED_REPOSITORIES_ENV_VAR = 'SCM_WEBHOOK_ALLOWED_REPOSITORIES';
const STRICT_REPOSITORY_ALLOWLIST_ENV_VAR = 'SCM_WEBHOOK_STRICT_REPOSITORY_ALLOWLIST';
const REQUIRE_DELIVERY_ID_ENV_VAR = 'SCM_WEBHOOK_REQUIRE_DELIVERY_ID';
const DELIVERY_TTL_SECONDS_ENV_VAR = 'SCM_WEBHOOK_DELIVERY_TTL_SECONDS';
const NODE_ENV_ENV_VAR = 'NODE_ENV';
const PRODUCTION_NODE_ENV = 'production';
const LEGACY_ALLOWED_REPOSITORIES_ENV_VAR = 'GITHUB_WEBHOOK_ALLOWED_REPOSITORIES';
const LEGACY_STRICT_REPOSITORY_ALLOWLIST_ENV_VAR = 'GITHUB_WEBHOOK_STRICT_REPOSITORY_ALLOWLIST';
const LEGACY_REQUIRE_DELIVERY_ID_ENV_VAR = 'GITHUB_WEBHOOK_REQUIRE_DELIVERY_ID';
const LEGACY_DELIVERY_TTL_SECONDS_ENV_VAR = 'GITHUB_WEBHOOK_DELIVERY_TTL_SECONDS';

const DEFAULT_DELIVERY_TTL_SECONDS = 60 * 60 * 24;
const MIN_DELIVERY_TTL_SECONDS = 1;
const POSITIVE_INTEGER_PATTERN = /^\d+$/;
const LEGACY_ENV_VAR_ERROR_MESSAGE =
  'Legacy env var %LEGACY_ENV_VAR% is no longer supported. Use %SCM_ENV_VAR%.';
const PRODUCTION_STRICT_ALLOWLIST_ERROR =
  'SCM_WEBHOOK_STRICT_REPOSITORY_ALLOWLIST must be true in production.';
const PRODUCTION_DELIVERY_ID_REQUIRED_ERROR = 'SCM_WEBHOOK_REQUIRE_DELIVERY_ID must be true in production.';
const PRODUCTION_ALLOWLIST_REQUIRED_ERROR =
  'SCM_WEBHOOK_ALLOWED_REPOSITORIES must include at least one repository in production.';

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

const isProductionNodeEnv = (value: string | undefined): boolean =>
  typeof value === 'string' && value.trim().toLowerCase() === PRODUCTION_NODE_ENV;

interface IngressSecurityPolicyInput {
  isProduction: boolean;
  allowedRepositories: string[];
  strictRepositoryAllowlist: boolean;
  requireDeliveryId: boolean;
}

const enforceIngressSecurityPolicy = ({
  isProduction,
  allowedRepositories,
  strictRepositoryAllowlist,
  requireDeliveryId,
}: IngressSecurityPolicyInput): void => {
  if (!isProduction) {
    return;
  }

  if (!strictRepositoryAllowlist) {
    throw new Error(PRODUCTION_STRICT_ALLOWLIST_ERROR);
  }

  if (!requireDeliveryId) {
    throw new Error(PRODUCTION_DELIVERY_ID_REQUIRED_ERROR);
  }

  if (allowedRepositories.length === 0) {
    throw new Error(PRODUCTION_ALLOWLIST_REQUIRED_ERROR);
  }
};

export interface WebhookIngressConfig {
  allowedRepositories: string[];
  strictRepositoryAllowlist: boolean;
  requireDeliveryId: boolean;
  deliveryTtlSeconds: number;
}

export const resolveWebhookIngressConfig = (config: ConfigPort): WebhookIngressConfig => {
  validateNoLegacyIngressEnvVars(config);

  const isProduction = isProductionNodeEnv(config.get(NODE_ENV_ENV_VAR));
  const allowedRepositories = parseAllowedRepositories(config.get(ALLOWED_REPOSITORIES_ENV_VAR));
  const strictRepositoryAllowlist = config.getBoolean(STRICT_REPOSITORY_ALLOWLIST_ENV_VAR) ?? isProduction;
  const requireDeliveryId = config.getBoolean(REQUIRE_DELIVERY_ID_ENV_VAR) ?? isProduction;
  const deliveryTtlSeconds =
    parsePositiveInteger(config.get(DELIVERY_TTL_SECONDS_ENV_VAR)) ?? DEFAULT_DELIVERY_TTL_SECONDS;

  enforceIngressSecurityPolicy({
    isProduction,
    allowedRepositories,
    strictRepositoryAllowlist,
    requireDeliveryId,
  });

  return {
    allowedRepositories,
    strictRepositoryAllowlist,
    requireDeliveryId,
    deliveryTtlSeconds,
  };
};
