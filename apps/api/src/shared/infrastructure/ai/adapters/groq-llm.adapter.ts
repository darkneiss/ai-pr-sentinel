import type { LLMGateway } from '../../../application/ports/llm-gateway.port';

const DEFAULT_GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';
const LLM_API_KEY_ENV_VAR = 'LLM_API_KEY';
const LLM_MODEL_ENV_VAR = 'LLM_MODEL';
const LLM_BASE_URL_ENV_VAR = 'LLM_BASE_URL';
const GROQ_API_KEY_ENV_VAR = 'GROQ_API_KEY';
const GROQ_MODEL_ENV_VAR = 'GROQ_MODEL';
const GROQ_BASE_URL_ENV_VAR = 'GROQ_BASE_URL';
const CHAT_COMPLETIONS_PATH = '/chat/completions';
const JSON_VALIDATION_ERROR_FRAGMENT = 'Failed to validate JSON';
const STRUCTURED_OUTPUT_SCHEMA_NAME = 'issue_triage_response';

interface CreateGroqLlmAdapterParams {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

interface GroqSuccessResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

interface GroqErrorResponse {
  error?: {
    message?: string;
  };
  message?: string;
}

interface GroqErrorContext {
  status: number;
  providerErrorMessage?: string;
}

const RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: true,
  required: ['classification', 'duplicateDetection', 'sentiment'],
  properties: {
    classification: {
      type: 'object',
      additionalProperties: true,
      required: ['type', 'confidence'],
      properties: {
        type: { type: 'string' },
        confidence: { type: 'number' },
        reasoning: { type: 'string' },
      },
    },
    duplicateDetection: {
      type: 'object',
      additionalProperties: true,
      required: ['isDuplicate', 'similarityScore'],
      properties: {
        isDuplicate: { type: 'boolean' },
        originalIssueNumber: { type: ['number', 'null'] },
        similarityScore: { type: 'number' },
      },
    },
    sentiment: {
      type: 'object',
      additionalProperties: true,
      required: ['tone', 'confidence'],
      properties: {
        tone: { type: 'string' },
        confidence: { type: 'number' },
        reasoning: { type: 'string' },
      },
    },
    suggestedResponse: {
      anyOf: [
        { type: 'string' },
        {
          type: 'array',
          items: { type: 'string' },
        },
      ],
    },
  },
};

const createAbortSignal = (timeoutMs: number): AbortSignal | undefined => {
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }

  return undefined;
};

const getGroqApiKey = (params: CreateGroqLlmAdapterParams): string => {
  const apiKey = params.apiKey ?? process.env[LLM_API_KEY_ENV_VAR] ?? process.env[GROQ_API_KEY_ENV_VAR];
  if (!apiKey) {
    throw new Error(`Missing Groq API key. Provide "apiKey" or set ${GROQ_API_KEY_ENV_VAR}`);
  }

  return apiKey;
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

const buildGroqEndpoint = (baseUrl: string): string => {
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

const extractRawText = (responseJson: GroqSuccessResponse): string | undefined => {
  const rawText = responseJson.choices?.[0]?.message?.content;

  if (typeof rawText !== 'string') {
    return undefined;
  }

  const normalizedRawText = rawText.trim();
  return normalizedRawText.length > 0 ? normalizedRawText : undefined;
};

const shouldRetryWithoutStructuredOutput = (errorContext: GroqErrorContext): boolean =>
  errorContext.status === 400 && (errorContext.providerErrorMessage?.includes(JSON_VALIDATION_ERROR_FRAGMENT) ?? false);

const buildGroqRequestBody = ({
  systemPrompt,
  userPrompt,
  model,
  maxTokens,
  temperature,
  includeStructuredOutput,
}: {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  maxTokens: number;
  temperature?: number;
  includeStructuredOutput: boolean;
}): Record<string, unknown> => {
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_completion_tokens: maxTokens,
    temperature,
  };

  if (includeStructuredOutput) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: STRUCTURED_OUTPUT_SCHEMA_NAME,
        schema: RESPONSE_SCHEMA,
      },
    };
  }

  return body;
};

const readGroqErrorContext = async (response: Response): Promise<GroqErrorContext> => {
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

const buildGroqRequestError = ({
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

const requestGroq = async ({
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

export const createGroqLlmAdapter = (params: CreateGroqLlmAdapterParams = {}): LLMGateway => {
  const apiKey = getGroqApiKey(params);
  const model =
    params.model ?? process.env[LLM_MODEL_ENV_VAR] ?? process.env[GROQ_MODEL_ENV_VAR] ?? DEFAULT_GROQ_MODEL;
  const baseUrl =
    params.baseUrl ?? process.env[LLM_BASE_URL_ENV_VAR] ?? process.env[GROQ_BASE_URL_ENV_VAR] ?? DEFAULT_GROQ_BASE_URL;
  const endpoint = buildGroqEndpoint(baseUrl);
  const fetchFn = params.fetchFn ?? fetch;

  return {
    generateJson: async ({ systemPrompt, userPrompt, maxTokens, timeoutMs, temperature }) => {
      const firstResponse = await requestGroq({
        fetchFn,
        endpoint,
        apiKey,
        timeoutMs,
        body: buildGroqRequestBody({
          systemPrompt,
          userPrompt,
          model,
          maxTokens,
          temperature,
          includeStructuredOutput: true,
        }),
      });

      if (!firstResponse.ok) {
        const firstErrorContext = await readGroqErrorContext(firstResponse);

        if (!shouldRetryWithoutStructuredOutput(firstErrorContext)) {
          throw buildGroqRequestError({
            errorContext: firstErrorContext,
            model,
            endpoint,
          });
        }

        const retryResponse = await requestGroq({
          fetchFn,
          endpoint,
          apiKey,
          timeoutMs,
          body: buildGroqRequestBody({
            systemPrompt,
            userPrompt,
            model,
            maxTokens,
            temperature,
            includeStructuredOutput: false,
          }),
        });

        if (!retryResponse.ok) {
          const retryErrorContext = await readGroqErrorContext(retryResponse);
          throw buildGroqRequestError({
            errorContext: retryErrorContext,
            model,
            endpoint,
          });
        }

        const retryResponseJson = (await retryResponse.json()) as GroqSuccessResponse;
        const retryRawText = extractRawText(retryResponseJson);
        if (!retryRawText) {
          throw new Error(`Groq response did not include text content for model ${model} at ${endpoint}`);
        }

        return { rawText: retryRawText };
      }

      const responseJson = (await firstResponse.json()) as GroqSuccessResponse;
      const rawText = extractRawText(responseJson);
      if (!rawText) {
        throw new Error(`Groq response did not include text content for model ${model} at ${endpoint}`);
      }

      return { rawText };
    },
  };
};
