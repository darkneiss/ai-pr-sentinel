import type { LLMGateway } from '../../shared/application/ports/llm-gateway.port';
import type { LLMObservabilityGateway } from '../../shared/application/ports/llm-observability-gateway.port';
import { createObservedLlmGateway } from '../../shared/application/observability/llm-gateway-observability.decorator';
import type { ConfigPort } from '../../shared/application/ports/config.port';
import { createGeminiLlmAdapter } from '../../shared/infrastructure/ai/adapters/gemini-llm.adapter';
import { createEnvConfig } from '../../shared/infrastructure/config/env-config.adapter';
import { createGroqLlmAdapter } from '../../shared/infrastructure/ai/adapters/groq-llm.adapter';
import { createOllamaLlmAdapter } from '../../shared/infrastructure/ai/adapters/ollama-llm.adapter';
import { createLangSmithObservabilityAdapter } from '../../shared/infrastructure/observability/langsmith-observability.adapter';

const LLM_PROVIDER_ENV_VAR = 'LLM_PROVIDER';
const LLM_MODEL_ENV_VAR = 'LLM_MODEL';
const LLM_BASE_URL_ENV_VAR = 'LLM_BASE_URL';
const GROQ_MODEL_ENV_VAR = 'GROQ_MODEL';
const GROQ_BASE_URL_ENV_VAR = 'GROQ_BASE_URL';
const GEMINI_MODEL_ENV_VAR = 'GEMINI_MODEL';
const GEMINI_BASE_URL_ENV_VAR = 'GEMINI_BASE_URL';
const OLLAMA_MODEL_ENV_VAR = 'OLLAMA_MODEL';
const OLLAMA_BASE_URL_ENV_VAR = 'OLLAMA_BASE_URL';
const LANGSMITH_TRACING_ENV_VAR = 'LANGSMITH_TRACING';
const DEFAULT_LLM_PROVIDER = 'ollama';
const SUPPORTED_PROVIDERS = ['gemini', 'ollama', 'groq'] as const;
const UNKNOWN_LLM_METADATA = 'unknown';

type LlmProvider = (typeof SUPPORTED_PROVIDERS)[number];

interface CreateLlmGatewayParams {
  provider?: string;
  config?: ConfigPort;
  createGeminiLlmAdapter?: () => LLMGateway;
  createOllamaLlmAdapter?: () => LLMGateway;
  createGroqLlmAdapter?: () => LLMGateway;
  createLangSmithObservabilityAdapter?: () => LLMObservabilityGateway;
}

const isSupportedProvider = (provider: string): provider is LlmProvider =>
  (SUPPORTED_PROVIDERS as readonly string[]).includes(provider);

const parseProvider = (provider: string): LlmProvider => {
  if (isSupportedProvider(provider)) {
    return provider;
  }

  throw new Error(`Unsupported LLM provider: "${provider}"`);
};

const resolveModel = (config: ConfigPort): string =>
  config.get(LLM_MODEL_ENV_VAR) ??
  config.get(GROQ_MODEL_ENV_VAR) ??
  config.get(GEMINI_MODEL_ENV_VAR) ??
  config.get(OLLAMA_MODEL_ENV_VAR) ??
  UNKNOWN_LLM_METADATA;

const resolveEndpoint = (config: ConfigPort): string | undefined =>
  config.get(LLM_BASE_URL_ENV_VAR) ??
  config.get(GROQ_BASE_URL_ENV_VAR) ??
  config.get(GEMINI_BASE_URL_ENV_VAR) ??
  config.get(OLLAMA_BASE_URL_ENV_VAR);

export const createLlmGateway = (params: CreateLlmGatewayParams = {}): LLMGateway => {
  const config = params.config ?? createEnvConfig();
  const providerValue = params.provider ?? config.get(LLM_PROVIDER_ENV_VAR) ?? DEFAULT_LLM_PROVIDER;
  const provider = parseProvider(providerValue);

  const geminiFactory = params.createGeminiLlmAdapter ?? (() => createGeminiLlmAdapter({ config }));
  const ollamaFactory = params.createOllamaLlmAdapter ?? (() => createOllamaLlmAdapter({ config }));
  const groqFactory = params.createGroqLlmAdapter ?? (() => createGroqLlmAdapter({ config }));
  const factoriesByProvider: Record<LlmProvider, () => LLMGateway> = {
    gemini: geminiFactory,
    ollama: ollamaFactory,
    groq: groqFactory,
  };

  const baseGateway = factoriesByProvider[provider]();
  const isLangSmithEnabled = config.getBoolean(LANGSMITH_TRACING_ENV_VAR) === true;

  if (!isLangSmithEnabled) {
    return baseGateway;
  }

  const observabilityFactory =
    params.createLangSmithObservabilityAdapter ?? (() => createLangSmithObservabilityAdapter({ config }));

  return createObservedLlmGateway({
    llmGateway: baseGateway,
    observabilityGateway: observabilityFactory(),
    requestContext: {
      provider,
      model: resolveModel(config),
      endpoint: resolveEndpoint(config),
    },
  });
};
