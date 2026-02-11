import type { LLMGateway } from '../../../application/ports/llm-gateway.port';
import type { ConfigPort } from '../../../application/ports/config.port';
import { createEnvConfig } from '../../config/env-config.adapter';

const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434/api/generate';
const DEFAULT_OLLAMA_MODEL = 'llama3.1';
const LLM_MODEL_ENV_VAR = 'LLM_MODEL';
const LLM_BASE_URL_ENV_VAR = 'LLM_BASE_URL';
const OLLAMA_MODEL_ENV_VAR = 'OLLAMA_MODEL';
const OLLAMA_BASE_URL_ENV_VAR = 'OLLAMA_BASE_URL';
const OLLAMA_RETRYABLE_STATUS_CODES = [429, 503] as const;

interface CreateOllamaLlmAdapterParams {
  baseUrl?: string;
  model?: string;
  fetchFn?: typeof fetch;
  config?: ConfigPort;
}

interface OllamaSuccessResponse {
  response?: string;
}

type GenerateJsonInput = Parameters<LLMGateway['generateJson']>[0];

const createAbortSignal = (timeoutMs: number): AbortSignal | undefined => {
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }

  return undefined;
};

const getOllamaBaseUrl = (params: CreateOllamaLlmAdapterParams, config: ConfigPort): string =>
  params.baseUrl ??
  config.get(LLM_BASE_URL_ENV_VAR) ??
  config.get(OLLAMA_BASE_URL_ENV_VAR) ??
  DEFAULT_OLLAMA_BASE_URL;

const getOllamaModel = (params: CreateOllamaLlmAdapterParams, config: ConfigPort): string =>
  params.model ?? config.get(LLM_MODEL_ENV_VAR) ?? config.get(OLLAMA_MODEL_ENV_VAR) ?? DEFAULT_OLLAMA_MODEL;

const buildOllamaEndpoint = (baseUrl: string): string => baseUrl;

const isRetryableStatus = (status: number): boolean =>
  (OLLAMA_RETRYABLE_STATUS_CODES as readonly number[]).includes(status);

const isTimeoutError = (error: unknown): boolean => error instanceof Error && error.name === 'AbortError';

const buildOllamaRequestBody = ({
  model,
  systemPrompt,
  userPrompt,
  maxTokens,
  temperature,
}: GenerateJsonInput & { model: string }): string =>
  JSON.stringify({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    stream: false,
    format: 'json',
    options: {
      temperature,
      num_predict: maxTokens,
    },
  });

const extractOllamaRawText = (responseJson: OllamaSuccessResponse): string => {
  const rawText = responseJson.response;
  if (typeof rawText !== 'string' || rawText.length === 0) {
    throw new Error('Ollama response did not include text content');
  }

  return rawText;
};

export const createOllamaLlmAdapter = (params: CreateOllamaLlmAdapterParams = {}): LLMGateway => {
  const config = params.config ?? createEnvConfig();
  const baseUrl = getOllamaBaseUrl(params, config);
  const model = getOllamaModel(params, config);
  const endpoint = buildOllamaEndpoint(baseUrl);
  const fetchFn = params.fetchFn ?? fetch;

  return {
    generateJson: async ({ systemPrompt, userPrompt, maxTokens, timeoutMs, temperature }) => {
      const requestOnce = async (): Promise<Response> =>
        fetchFn(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: buildOllamaRequestBody({
            model,
            systemPrompt,
            userPrompt,
            maxTokens,
            timeoutMs,
            temperature,
          }),
          signal: createAbortSignal(timeoutMs),
        });

      const buildOllamaError = (status: number): Error => new Error(`Ollama request failed with status ${status}`);

      const handleNonOkResponse = async (response: Response): Promise<OllamaSuccessResponse> => {
        if (!isRetryableStatus(response.status)) {
          throw buildOllamaError(response.status);
        }

        const retryResponse = await requestOnce();
        if (!retryResponse.ok) {
          throw buildOllamaError(retryResponse.status);
        }

        return (await retryResponse.json()) as OllamaSuccessResponse;
      };

      const requestWithRetry = async (): Promise<OllamaSuccessResponse> => {
        try {
          const response = await requestOnce();
          if (!response.ok) {
            return handleNonOkResponse(response);
          }

          return (await response.json()) as OllamaSuccessResponse;
        } catch (error: unknown) {
          if (!isTimeoutError(error)) {
            throw error;
          }

          const retryResponse = await requestOnce();
          if (!retryResponse.ok) {
            throw buildOllamaError(retryResponse.status);
          }

          return (await retryResponse.json()) as OllamaSuccessResponse;
        }
      };

      const responseJson = await requestWithRetry();
      return { rawText: extractOllamaRawText(responseJson) };
    },
  };
};
