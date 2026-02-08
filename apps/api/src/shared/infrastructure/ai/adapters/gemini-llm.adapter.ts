import type { LLMGateway } from '../../../application/ports/llm-gateway.port';

const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash';
const LLM_API_KEY_ENV_VAR = 'LLM_API_KEY';
const LLM_MODEL_ENV_VAR = 'LLM_MODEL';
const LLM_BASE_URL_ENV_VAR = 'LLM_BASE_URL';
const GEMINI_API_KEY_ENV_VAR = 'GEMINI_API_KEY';
const GEMINI_MODEL_ENV_VAR = 'GEMINI_MODEL';
const GEMINI_BASE_URL_ENV_VAR = 'GEMINI_BASE_URL';

interface CreateGeminiLlmAdapterParams {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

interface GeminiSuccessResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

interface GeminiErrorResponse {
  error?: {
    message?: string;
  };
}

type GenerateJsonInput = Parameters<LLMGateway['generateJson']>[0];

const createAbortSignal = (timeoutMs: number): AbortSignal | undefined => {
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }

  return undefined;
};

const getGeminiApiKey = (params: CreateGeminiLlmAdapterParams): string => {
  const apiKey = params.apiKey ?? process.env[LLM_API_KEY_ENV_VAR] ?? process.env[GEMINI_API_KEY_ENV_VAR];
  if (!apiKey) {
    throw new Error(`Missing Gemini API key. Provide "apiKey" or set ${GEMINI_API_KEY_ENV_VAR}`);
  }

  return apiKey;
};

const getGeminiModel = (params: CreateGeminiLlmAdapterParams): string =>
  params.model ?? process.env[LLM_MODEL_ENV_VAR] ?? process.env[GEMINI_MODEL_ENV_VAR] ?? DEFAULT_GEMINI_MODEL;

const getGeminiBaseUrl = (params: CreateGeminiLlmAdapterParams): string =>
  params.baseUrl ??
  process.env[LLM_BASE_URL_ENV_VAR] ??
  process.env[GEMINI_BASE_URL_ENV_VAR] ??
  DEFAULT_GEMINI_BASE_URL;

const buildGeminiEndpoint = (baseUrl: string, model: string, apiKey: string): string =>
  `${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

const buildGeminiRequestBody = ({
  systemPrompt,
  userPrompt,
  maxTokens,
  temperature,
}: GenerateJsonInput): string =>
  JSON.stringify({
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature,
      responseMimeType: 'application/json',
    },
  });

const buildGeminiRequestError = ({
  status,
  model,
  responseJson,
}: {
  status: number;
  model: string;
  responseJson?: GeminiErrorResponse;
}): Error => {
  const errorMessage = responseJson?.error?.message;
  const details = errorMessage ? `: ${errorMessage}` : '';

  return new Error(`Gemini request failed with status ${status} for model ${model}${details}`);
};

const extractGeminiRawText = (responseJson: GeminiSuccessResponse): string => {
  const rawText = responseJson.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof rawText !== 'string' || rawText.length === 0) {
    throw new Error('Gemini response did not include text content');
  }

  return rawText;
};

export const createGeminiLlmAdapter = (params: CreateGeminiLlmAdapterParams = {}): LLMGateway => {
  const apiKey = getGeminiApiKey(params);
  const model = getGeminiModel(params);
  const baseUrl = getGeminiBaseUrl(params);
  const endpoint = buildGeminiEndpoint(baseUrl, model, apiKey);
  const fetchFn = params.fetchFn ?? fetch;

  return {
    generateJson: async ({ systemPrompt, userPrompt, maxTokens, timeoutMs, temperature }) => {
      const response = await fetchFn(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: buildGeminiRequestBody({
          systemPrompt,
          userPrompt,
          maxTokens,
          timeoutMs,
          temperature,
        }),
        signal: createAbortSignal(timeoutMs),
      });

      if (!response.ok) {
        const responseJson = (await response.json().catch(() => undefined)) as GeminiErrorResponse | undefined;
        throw buildGeminiRequestError({
          status: response.status,
          model,
          responseJson,
        });
      }

      const responseJson = (await response.json()) as GeminiSuccessResponse;

      return { rawText: extractGeminiRawText(responseJson) };
    },
  };
};
