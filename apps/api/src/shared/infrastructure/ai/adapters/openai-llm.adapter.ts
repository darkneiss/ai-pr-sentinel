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
    text?: string | null;
    message?: {
      content?:
        | string
        | { type?: string; text?: string }
        | Array<{ type?: string; text?: string }>
        | null;
    };
  }>;
}

interface OpenAiErrorResponse {
  error?: {
    message?: string;
  };
  message?: string;
}

const createAbortSignal = (timeoutMs: number): AbortSignal | undefined => {
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }

  return undefined;
};

const parseProviderErrorMessage = (value: unknown): string | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const errorResponse = value as OpenAiErrorResponse;
  const nestedErrorMessage = errorResponse.error?.message;
  if (typeof nestedErrorMessage === 'string' && nestedErrorMessage.length > 0) {
    return nestedErrorMessage;
  }

  if (typeof errorResponse.message === 'string' && errorResponse.message.length > 0) {
    return errorResponse.message;
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

const extractRawText = (responseJson: OpenAiSuccessResponse): string | undefined => {
  const firstChoice = responseJson.choices?.[0];
  const messageContent = firstChoice?.message?.content;
  if (typeof messageContent === 'string' && messageContent.length > 0) {
    return messageContent;
  }

  if (
    !!messageContent &&
    typeof messageContent === 'object' &&
    !Array.isArray(messageContent) &&
    typeof messageContent.text === 'string' &&
    messageContent.text.trim().length > 0
  ) {
    return messageContent.text.trim();
  }

  if (Array.isArray(messageContent)) {
    const combinedText = messageContent
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('')
      .trim();
    if (combinedText.length > 0) {
      return combinedText;
    }
  }

  const fallbackText = firstChoice?.text;
  if (typeof fallbackText === 'string' && fallbackText.length > 0) {
    return fallbackText;
  }

  return undefined;
};

const getResponseShapeSummary = (responseJson: OpenAiSuccessResponse): string => {
  const firstChoice = responseJson.choices?.[0];
  const messageContent = firstChoice?.message?.content;
  const contentType = Array.isArray(messageContent)
    ? 'array'
    : messageContent === null
      ? 'null'
      : typeof messageContent;
  const choiceKeys = firstChoice && typeof firstChoice === 'object' ? Object.keys(firstChoice).join(',') : 'none';
  return `choices=${Array.isArray(responseJson.choices) ? responseJson.choices.length : 0}; first_choice_keys=${choiceKeys}; content_type=${contentType}`;
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
      const endpoint = `${baseUrl}/v1/chat/completions`;
      const response = await fetchFn(endpoint, {
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
        let providerErrorMessage: string | undefined;
        try {
          const errorPayload = (await response.json()) as unknown;
          providerErrorMessage = parseProviderErrorMessage(errorPayload);
        } catch (_error: unknown) {
          providerErrorMessage = undefined;
        }

        const providerMessageSuffix = providerErrorMessage ? `: ${providerErrorMessage}` : '';
        throw new Error(
          `OpenAI request failed with status ${response.status} for model ${model} at ${endpoint}${providerMessageSuffix}`,
        );
      }

      const responseJson = (await response.json()) as OpenAiSuccessResponse;
      const rawText = extractRawText(responseJson);
      if (!rawText) {
        const responseShapeSummary = getResponseShapeSummary(responseJson);
        throw new Error(
          `OpenAI response did not include text content for model ${model} at ${endpoint}. response_shape=${responseShapeSummary}`,
        );
      }

      return { rawText };
    },
  };
};
