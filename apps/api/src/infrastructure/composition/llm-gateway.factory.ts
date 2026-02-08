import type { LLMGateway } from '../../shared/application/ports/llm-gateway.port';
import type { ConfigPort } from '../../shared/application/ports/config.port';
import { createGeminiLlmAdapter } from '../../shared/infrastructure/ai/adapters/gemini-llm.adapter';
import { createEnvConfig } from '../../shared/infrastructure/config/env-config.adapter';
import { createGroqLlmAdapter } from '../../shared/infrastructure/ai/adapters/groq-llm.adapter';
import { createOllamaLlmAdapter } from '../../shared/infrastructure/ai/adapters/ollama-llm.adapter';

const LLM_PROVIDER_ENV_VAR = 'LLM_PROVIDER';
const DEFAULT_LLM_PROVIDER = 'ollama';
const SUPPORTED_PROVIDERS = ['gemini', 'ollama', 'groq'] as const;

type LlmProvider = (typeof SUPPORTED_PROVIDERS)[number];

interface CreateLlmGatewayParams {
  provider?: string;
  config?: ConfigPort;
  createGeminiLlmAdapter?: () => LLMGateway;
  createOllamaLlmAdapter?: () => LLMGateway;
  createGroqLlmAdapter?: () => LLMGateway;
}

const isSupportedProvider = (provider: string): provider is LlmProvider =>
  (SUPPORTED_PROVIDERS as readonly string[]).includes(provider);

const parseProvider = (provider: string): LlmProvider => {
  if (isSupportedProvider(provider)) {
    return provider;
  }

  throw new Error(`Unsupported LLM provider: "${provider}"`);
};

export const createLlmGateway = (params: CreateLlmGatewayParams = {}): LLMGateway => {
  const config = params.config ?? createEnvConfig();
  const providerValue = params.provider ?? config.get(LLM_PROVIDER_ENV_VAR) ?? DEFAULT_LLM_PROVIDER;
  const provider = parseProvider(providerValue);

  const geminiFactory = params.createGeminiLlmAdapter ?? createGeminiLlmAdapter;
  const ollamaFactory = params.createOllamaLlmAdapter ?? createOllamaLlmAdapter;
  const groqFactory = params.createGroqLlmAdapter ?? createGroqLlmAdapter;
  const factoriesByProvider: Record<LlmProvider, () => LLMGateway> = {
    gemini: geminiFactory,
    ollama: ollamaFactory,
    groq: groqFactory,
  };

  return factoriesByProvider[provider]();
};
