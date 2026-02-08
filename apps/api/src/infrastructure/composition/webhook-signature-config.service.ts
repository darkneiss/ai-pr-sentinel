const GITHUB_WEBHOOK_SECRET_ENV_VAR = 'GITHUB_WEBHOOK_SECRET';
const GITHUB_WEBHOOK_VERIFY_SIGNATURE_ENV_VAR = 'GITHUB_WEBHOOK_VERIFY_SIGNATURE';
const NODE_ENV_ENV_VAR = 'NODE_ENV';
const PRODUCTION_NODE_ENV = 'production';

const parseBooleanEnv = (value: string | undefined): boolean | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === 'true') {
    return true;
  }

  if (normalizedValue === 'false') {
    return false;
  }

  return undefined;
};

const shouldVerifyWebhookSignature = (): boolean => {
  const explicitVerifySignature = parseBooleanEnv(process.env[GITHUB_WEBHOOK_VERIFY_SIGNATURE_ENV_VAR]);
  if (explicitVerifySignature !== undefined) {
    return explicitVerifySignature;
  }

  if (process.env[NODE_ENV_ENV_VAR] === PRODUCTION_NODE_ENV) {
    return true;
  }

  const webhookSecret = process.env[GITHUB_WEBHOOK_SECRET_ENV_VAR];
  return typeof webhookSecret === 'string' && webhookSecret.length > 0;
};

export interface WebhookSignatureConfig {
  verifyWebhookSignature: boolean;
  webhookSecret?: string;
}

export const resolveWebhookSignatureConfig = (): WebhookSignatureConfig => {
  const verifyWebhookSignature = shouldVerifyWebhookSignature();
  const webhookSecret = process.env[GITHUB_WEBHOOK_SECRET_ENV_VAR];

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
