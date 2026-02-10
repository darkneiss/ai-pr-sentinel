import type { LLMGateway } from '../../../application/ports/llm-gateway.port';
import type { ConfigPort } from '../../../application/ports/config.port';
import { createEnvConfig } from '../../config/env-config.adapter';

const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash';
const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
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
  config?: ConfigPort;
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

const getGeminiApiKey = (params: CreateGeminiLlmAdapterParams, config: ConfigPort): string => {
  const apiKey = params.apiKey ?? config.get(LLM_API_KEY_ENV_VAR) ?? config.get(GEMINI_API_KEY_ENV_VAR);
  if (!apiKey) {
    throw new Error(`Missing Gemini API key. Provide "apiKey" or set ${GEMINI_API_KEY_ENV_VAR}`);
  }

  return apiKey;
};

const getGeminiModel = (params: CreateGeminiLlmAdapterParams, config: ConfigPort): string =>
  params.model ?? config.get(LLM_MODEL_ENV_VAR) ?? config.get(GEMINI_MODEL_ENV_VAR) ?? DEFAULT_GEMINI_MODEL;

const getGeminiBaseUrl = (params: CreateGeminiLlmAdapterParams, config: ConfigPort): string =>
  params.baseUrl ??
  config.get(LLM_BASE_URL_ENV_VAR) ??
  config.get(GEMINI_BASE_URL_ENV_VAR) ??
  DEFAULT_GEMINI_BASE_URL;

const buildGeminiEndpoint = (baseUrl: string, model: string): string => {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

  if (normalizedBaseUrl.includes('/models/')) {
    return normalizedBaseUrl;
  }

  return `${normalizedBaseUrl}/models/${model}:generateContent`;
};

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
  const config = params.config ?? createEnvConfig();
  const apiKey = getGeminiApiKey(params, config);
  const model = getGeminiModel(params, config);
  const baseUrl = getGeminiBaseUrl(params, config);
  const endpoint = buildGeminiEndpoint(baseUrl, model);
  const fetchFn = params.fetchFn ?? fetch;

  return {
    generateJson: async ({ systemPrompt, userPrompt, maxTokens, timeoutMs, temperature }) => {
      const response = await fetchFn(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
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
