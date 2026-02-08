import type { LLMGateway } from '../../../application/ports/llm-gateway.port';

const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_MODEL = 'llama3.1';
const LLM_MODEL_ENV_VAR = 'LLM_MODEL';
const LLM_BASE_URL_ENV_VAR = 'LLM_BASE_URL';
const OLLAMA_MODEL_ENV_VAR = 'OLLAMA_MODEL';
const OLLAMA_BASE_URL_ENV_VAR = 'OLLAMA_BASE_URL';

interface CreateOllamaLlmAdapterParams {
  baseUrl?: string;
  model?: string;
  fetchFn?: typeof fetch;
}

interface OllamaSuccessResponse {
  response?: string;
}

const createAbortSignal = (timeoutMs: number): AbortSignal | undefined => {
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }

  return undefined;
};

export const createOllamaLlmAdapter = (params: CreateOllamaLlmAdapterParams = {}): LLMGateway => {
  const baseUrl =
    params.baseUrl ??
    process.env[LLM_BASE_URL_ENV_VAR] ??
    process.env[OLLAMA_BASE_URL_ENV_VAR] ??
    DEFAULT_OLLAMA_BASE_URL;
  const model =
    params.model ??
    process.env[LLM_MODEL_ENV_VAR] ??
    process.env[OLLAMA_MODEL_ENV_VAR] ??
    DEFAULT_OLLAMA_MODEL;
  const fetchFn = params.fetchFn ?? fetch;

  return {
    generateJson: async ({ systemPrompt, userPrompt, maxTokens, timeoutMs, temperature }) => {
      const response = await fetchFn(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          system: systemPrompt,
          prompt: userPrompt,
          stream: false,
          options: {
            temperature,
            num_predict: maxTokens,
          },
        }),
        signal: createAbortSignal(timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed with status ${response.status}`);
      }

      const responseJson = (await response.json()) as OllamaSuccessResponse;
      const rawText = responseJson.response;
      if (typeof rawText !== 'string' || rawText.length === 0) {
        throw new Error('Ollama response did not include text content');
      }

      return { rawText };
    },
  };
};
