import type { LLMGateway } from '../../../application/ports/llm-gateway.port';

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const LLM_API_KEY_ENV_VAR = 'LLM_API_KEY';
const LLM_MODEL_ENV_VAR = 'LLM_MODEL';
const LLM_BASE_URL_ENV_VAR = 'LLM_BASE_URL';
const OPENAI_API_KEY_ENV_VAR = 'OPENAI_API_KEY';
const OPENAI_MODEL_ENV_VAR = 'OPENAI_MODEL';
const OPENAI_BASE_URL_ENV_VAR = 'OPENAI_BASE_URL';

interface CreateOpenAiLlmAdapterParams {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

interface OpenAiSuccessResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

const createAbortSignal = (timeoutMs: number): AbortSignal | undefined => {
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }

  return undefined;
};

const getOpenAiApiKey = (params: CreateOpenAiLlmAdapterParams): string => {
  const apiKey = params.apiKey ?? process.env[LLM_API_KEY_ENV_VAR] ?? process.env[OPENAI_API_KEY_ENV_VAR];
  if (!apiKey) {
    throw new Error(`Missing OpenAI API key. Provide "apiKey" or set ${OPENAI_API_KEY_ENV_VAR}`);
  }

  return apiKey;
};

export const createOpenAiLlmAdapter = (params: CreateOpenAiLlmAdapterParams = {}): LLMGateway => {
  const apiKey = getOpenAiApiKey(params);
  const model =
    params.model ??
    process.env[LLM_MODEL_ENV_VAR] ??
    process.env[OPENAI_MODEL_ENV_VAR] ??
    DEFAULT_OPENAI_MODEL;
  const baseUrl =
    params.baseUrl ??
    process.env[LLM_BASE_URL_ENV_VAR] ??
    process.env[OPENAI_BASE_URL_ENV_VAR] ??
    DEFAULT_OPENAI_BASE_URL;
  const fetchFn = params.fetchFn ?? fetch;

  return {
    generateJson: async ({ systemPrompt, userPrompt, maxTokens, timeoutMs, temperature }) => {
      const response = await fetchFn(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
          temperature,
        }),
        signal: createAbortSignal(timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`OpenAI request failed with status ${response.status}`);
      }

      const responseJson = (await response.json()) as OpenAiSuccessResponse;
      const rawText = responseJson.choices?.[0]?.message?.content;
      if (typeof rawText !== 'string' || rawText.length === 0) {
        throw new Error('OpenAI response did not include text content');
      }

      return { rawText };
    },
  };
};
