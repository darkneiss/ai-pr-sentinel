import type { LLMGateway } from '../../../application/ports/llm-gateway.port';
import type { ConfigPort } from '../../../application/ports/config.port';
import { createEnvConfig } from '../../config/env-config.adapter';
import {
  DEFAULT_GROQ_BASE_URL,
  DEFAULT_GROQ_MODEL,
  GROQ_API_KEY_ENV_VAR,
  GROQ_BASE_URL_ENV_VAR,
  GROQ_MODEL_ENV_VAR,
  LLM_API_KEY_ENV_VAR,
  LLM_BASE_URL_ENV_VAR,
  LLM_MODEL_ENV_VAR,
} from './groq-adapter.constants';
import type { CreateGroqLlmAdapterParams, GroqSuccessResponse } from './groq-adapter.types';
import {
  buildGroqEndpoint,
  buildGroqRequestError,
  extractRawText,
  readGroqErrorContext,
  requestGroq,
  shouldRetryWithoutStructuredOutput,
} from './groq-adapter-http.service';
import { buildGroqRequestBody } from './groq-request-body-builder.service';

const getGroqApiKey = (params: CreateGroqLlmAdapterParams): string => {
  const config = params.config ?? createEnvConfig();
  const apiKey = params.apiKey ?? config.get(LLM_API_KEY_ENV_VAR) ?? config.get(GROQ_API_KEY_ENV_VAR);
  if (!apiKey) {
    throw new Error(`Missing Groq API key. Provide "apiKey" or set ${GROQ_API_KEY_ENV_VAR}`);
  }

  return apiKey;
};

export const createGroqLlmAdapter = (params: CreateGroqLlmAdapterParams = {}): LLMGateway => {
  const config = params.config ?? createEnvConfig();
  const apiKey = getGroqApiKey(params);
  const model =
    params.model ?? config.get(LLM_MODEL_ENV_VAR) ?? config.get(GROQ_MODEL_ENV_VAR) ?? DEFAULT_GROQ_MODEL;
  const baseUrl =
    params.baseUrl ??
    config.get(LLM_BASE_URL_ENV_VAR) ??
    config.get(GROQ_BASE_URL_ENV_VAR) ??
    DEFAULT_GROQ_BASE_URL;
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
