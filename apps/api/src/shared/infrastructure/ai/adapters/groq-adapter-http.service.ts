import {
  CHAT_COMPLETIONS_PATH,
  JSON_VALIDATION_ERROR_FRAGMENT,
} from './groq-adapter.constants';
import type { GroqErrorContext, GroqErrorResponse, GroqSuccessResponse } from './groq-adapter.types';

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

  const errorResponse = value as GroqErrorResponse;
  if (typeof errorResponse.error?.message === 'string' && errorResponse.error.message.length > 0) {
    return errorResponse.error.message;
  }

  if (typeof errorResponse.message === 'string' && errorResponse.message.length > 0) {
    return errorResponse.message;
  }

  return undefined;
};

export const buildGroqEndpoint = (baseUrl: string): string => {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

  if (normalizedBaseUrl.endsWith(CHAT_COMPLETIONS_PATH)) {
    return normalizedBaseUrl;
  }

  if (normalizedBaseUrl.endsWith('/openai')) {
    return `${normalizedBaseUrl}/v1${CHAT_COMPLETIONS_PATH}`;
  }

  if (normalizedBaseUrl.endsWith('/v1')) {
    return `${normalizedBaseUrl}${CHAT_COMPLETIONS_PATH}`;
  }

  return `${normalizedBaseUrl}${CHAT_COMPLETIONS_PATH}`;
};

export const extractRawText = (responseJson: GroqSuccessResponse): string | undefined => {
  const rawText = responseJson.choices?.[0]?.message?.content;

  if (typeof rawText !== 'string') {
    return undefined;
  }

  const normalizedRawText = rawText.trim();
  return normalizedRawText.length > 0 ? normalizedRawText : undefined;
};

export const shouldRetryWithoutStructuredOutput = (errorContext: GroqErrorContext): boolean =>
  errorContext.status === 400 && (errorContext.providerErrorMessage?.includes(JSON_VALIDATION_ERROR_FRAGMENT) ?? false);

export const readGroqErrorContext = async (response: Response): Promise<GroqErrorContext> => {
  let providerErrorMessage: string | undefined;

  try {
    const errorPayload = (await response.json()) as unknown;
    providerErrorMessage = parseProviderErrorMessage(errorPayload);
  } catch (_error: unknown) {
    providerErrorMessage = undefined;
  }

  return {
    status: response.status,
    providerErrorMessage,
  };
};

export const buildGroqRequestError = ({
  errorContext,
  model,
  endpoint,
}: {
  errorContext: GroqErrorContext;
  model: string;
  endpoint: string;
}): Error => {
  const providerMessageSuffix = errorContext.providerErrorMessage ? `: ${errorContext.providerErrorMessage}` : '';

  return new Error(
    `Groq request failed with status ${errorContext.status} for model ${model} at ${endpoint}${providerMessageSuffix}`,
  );
};

export const requestGroq = async ({
  fetchFn,
  endpoint,
  apiKey,
  body,
  timeoutMs,
}: {
  fetchFn: typeof fetch;
  endpoint: string;
  apiKey: string;
  body: Record<string, unknown>;
  timeoutMs: number;
}): Promise<Response> =>
  fetchFn(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: createAbortSignal(timeoutMs),
  });
