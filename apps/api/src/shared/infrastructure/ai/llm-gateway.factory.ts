import type { LLMGateway } from '../../application/ports/llm-gateway.port';
import { createGeminiLlmAdapter } from './adapters/gemini-llm.adapter';
import { createGroqLlmAdapter } from './adapters/groq-llm.adapter';
import { createOllamaLlmAdapter } from './adapters/ollama-llm.adapter';

const LLM_PROVIDER_ENV_VAR = 'LLM_PROVIDER';
const DEFAULT_LLM_PROVIDER = 'ollama';

type LlmProvider = 'gemini' | 'ollama' | 'groq';

interface CreateLlmGatewayParams {
  provider?: string;
  createGeminiLlmAdapter?: () => LLMGateway;
  createOllamaLlmAdapter?: () => LLMGateway;
  createGroqLlmAdapter?: () => LLMGateway;
}

const parseProvider = (provider: string): LlmProvider => {
  if (provider === 'gemini' || provider === 'ollama' || provider === 'groq') {
    return provider;
  }

  throw new Error(`Unsupported LLM provider: "${provider}"`);
};

export const createLlmGateway = (params: CreateLlmGatewayParams = {}): LLMGateway => {
  const providerValue = params.provider ?? process.env[LLM_PROVIDER_ENV_VAR] ?? DEFAULT_LLM_PROVIDER;
  const provider = parseProvider(providerValue);

  const geminiFactory = params.createGeminiLlmAdapter ?? createGeminiLlmAdapter;
  const ollamaFactory = params.createOllamaLlmAdapter ?? createOllamaLlmAdapter;
  const groqFactory = params.createGroqLlmAdapter ?? createGroqLlmAdapter;

  if (provider === 'gemini') {
    return geminiFactory();
  }

  if (provider === 'groq') {
    return groqFactory();
  }

  return ollamaFactory();
};
