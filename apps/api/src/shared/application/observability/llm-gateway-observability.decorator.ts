import type { LLMGateway } from '../ports/llm-gateway.port';
import type { LLMObservabilityGateway } from '../ports/llm-observability-gateway.port';
import {
  LLM_OBSERVABILITY_RUN_NAME,
  LLM_OBSERVABILITY_RUN_TYPE,
} from '../constants/llm-observability.constants';

interface Logger {
  debug?: (message: string, context?: Record<string, unknown>) => void;
}

export interface LlmObservabilityRequestContext {
  provider: string;
  model: string;
  endpoint?: string;
}

interface CreateObservedLlmGatewayParams {
  llmGateway: LLMGateway;
  observabilityGateway: LLMObservabilityGateway;
  requestContext: LlmObservabilityRequestContext;
  logger?: Logger;
}

const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
};

export const createObservedLlmGateway = ({
  llmGateway,
  observabilityGateway,
  requestContext,
  logger,
}: CreateObservedLlmGatewayParams): LLMGateway => ({
  generateJson: async (input) => {
    const startedAt = new Date().toISOString();
    let runId: string | undefined;

    try {
      const requestResult = await observabilityGateway.trackRequest({
        runName: LLM_OBSERVABILITY_RUN_NAME,
        runType: LLM_OBSERVABILITY_RUN_TYPE,
        provider: requestContext.provider,
        model: requestContext.model,
        endpoint: requestContext.endpoint,
        inputs: {
          systemPrompt: input.systemPrompt,
          userPrompt: input.userPrompt,
          maxTokens: input.maxTokens,
          timeoutMs: input.timeoutMs,
          temperature: input.temperature,
        },
        metadata: {
          provider: requestContext.provider,
          model: requestContext.model,
          endpoint: requestContext.endpoint,
        },
        startedAt,
      });
      runId = requestResult.runId;
    } catch (error: unknown) {
      logger?.debug?.('LLM observability tracking failed to record request.', {
        error,
      });
    }

    try {
      const result = await llmGateway.generateJson(input);
      if (runId) {
        try {
          await observabilityGateway.trackResponse({
            runId,
            outputs: {
              rawText: result.rawText,
            },
            endedAt: new Date().toISOString(),
          });
        } catch (error: unknown) {
          logger?.debug?.('LLM observability tracking failed to record response.', {
            error,
          });
        }
      }

      return result;
    } catch (error: unknown) {
      if (runId) {
        try {
          await observabilityGateway.trackError({
            runId,
            errorMessage: extractErrorMessage(error),
            endedAt: new Date().toISOString(),
          });
        } catch (observabilityError: unknown) {
          logger?.debug?.('LLM observability tracking failed to record error.', {
            error: observabilityError,
          });
        }
      }

      throw error;
    }
  },
});
