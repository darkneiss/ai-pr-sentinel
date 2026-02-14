import type { ConfigPort } from '../../shared/application/ports/config.port';

const SCM_WEBHOOK_SECRET_ENV_VAR = 'SCM_WEBHOOK_SECRET';
const SCM_WEBHOOK_VERIFY_SIGNATURE_ENV_VAR = 'SCM_WEBHOOK_VERIFY_SIGNATURE';
const LEGACY_WEBHOOK_SECRET_ENV_VAR = 'GITHUB_WEBHOOK_SECRET';
const LEGACY_WEBHOOK_VERIFY_SIGNATURE_ENV_VAR = 'GITHUB_WEBHOOK_VERIFY_SIGNATURE';
const NODE_ENV_ENV_VAR = 'NODE_ENV';
const PRODUCTION_NODE_ENV = 'production';
const LEGACY_ENV_VAR_ERROR_MESSAGE =
  'Legacy env var %LEGACY_ENV_VAR% is no longer supported. Use %SCM_ENV_VAR%.';

interface LegacyEnvAlias {
  scmEnvVar: string;
  legacyEnvVar: string;
}

const LEGACY_SIGNATURE_ENV_ALIASES: readonly LegacyEnvAlias[] = [
  {
    scmEnvVar: SCM_WEBHOOK_SECRET_ENV_VAR,
    legacyEnvVar: LEGACY_WEBHOOK_SECRET_ENV_VAR,
  },
  {
    scmEnvVar: SCM_WEBHOOK_VERIFY_SIGNATURE_ENV_VAR,
    legacyEnvVar: LEGACY_WEBHOOK_VERIFY_SIGNATURE_ENV_VAR,
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

const validateNoLegacySignatureEnvVars = (config: ConfigPort): void => {
  for (const alias of LEGACY_SIGNATURE_ENV_ALIASES) {
    const scmValue = config.get(alias.scmEnvVar);
    const legacyValue = config.get(alias.legacyEnvVar);

    if (hasConfiguredEnvValue(legacyValue) && !hasConfiguredEnvValue(scmValue)) {
      throwLegacyEnvVarError(alias.legacyEnvVar, alias.scmEnvVar);
    }
  }
};

const shouldVerifyWebhookSignature = (config: ConfigPort): boolean => {
  const explicitVerifySignature = config.getBoolean(SCM_WEBHOOK_VERIFY_SIGNATURE_ENV_VAR);
  if (explicitVerifySignature !== undefined) {
    return explicitVerifySignature;
  }

  if (config.get(NODE_ENV_ENV_VAR) === PRODUCTION_NODE_ENV) {
    return true;
  }

  const webhookSecret = config.get(SCM_WEBHOOK_SECRET_ENV_VAR);
  return typeof webhookSecret === 'string' && webhookSecret.length > 0;
};

export interface WebhookSignatureConfig {
  verifyWebhookSignature: boolean;
  webhookSecret?: string;
}

export const resolveWebhookSignatureConfig = (config: ConfigPort): WebhookSignatureConfig => {
  validateNoLegacySignatureEnvVars(config);
  const verifyWebhookSignature = shouldVerifyWebhookSignature(config);
  const webhookSecret = config.get(SCM_WEBHOOK_SECRET_ENV_VAR);

  if (verifyWebhookSignature && (!webhookSecret || webhookSecret.length === 0)) {
    throw new Error(
      `Missing ${SCM_WEBHOOK_SECRET_ENV_VAR} while ${SCM_WEBHOOK_VERIFY_SIGNATURE_ENV_VAR}=true`,
    );
  }

  return {
    verifyWebhookSignature,
    webhookSecret,
  };
};
