import type { ConfigPort } from '../../shared/application/ports/config.port';

const SCM_PROVIDER_ENV_VAR = 'SCM_PROVIDER';
const DEFAULT_SCM_PROVIDER = 'github';
const SCM_PROVIDER_GITHUB = 'github';
const SUPPORTED_SCM_PROVIDERS = [SCM_PROVIDER_GITHUB] as const;

export type ScmProvider = (typeof SUPPORTED_SCM_PROVIDERS)[number];

const normalizeScmProvider = (value: string | undefined): string => {
  if (typeof value !== 'string') {
    return DEFAULT_SCM_PROVIDER;
  }

  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return DEFAULT_SCM_PROVIDER;
  }

  return trimmedValue.toLowerCase();
};

const isSupportedScmProvider = (provider: string): provider is ScmProvider =>
  (SUPPORTED_SCM_PROVIDERS as readonly string[]).includes(provider);

export const resolveScmProvider = (config: ConfigPort): ScmProvider => {
  const normalizedProvider = normalizeScmProvider(config.get(SCM_PROVIDER_ENV_VAR));
  if (!isSupportedScmProvider(normalizedProvider)) {
    throw new Error(
      `Unsupported SCM provider "${normalizedProvider}". Supported providers: ${SUPPORTED_SCM_PROVIDERS.join(', ')}`,
    );
  }

  return normalizedProvider;
};
