export type LlmObservabilityRunType = 'llm';

export interface LlmObservabilityRequest {
  runName: string;
  runType: LlmObservabilityRunType;
  provider: string;
  model: string;
  endpoint?: string;
  inputs: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  startedAt: string;
}

export interface LlmObservabilityResponse {
  runId: string;
  outputs: Record<string, unknown>;
  endedAt: string;
}

export interface LlmObservabilityError {
  runId?: string;
  errorMessage: string;
  endedAt: string;
}

export interface LLMObservabilityGateway {
  trackRequest(input: LlmObservabilityRequest): Promise<{ runId: string }>;
  trackResponse(input: LlmObservabilityResponse): Promise<void>;
  trackError(input: LlmObservabilityError): Promise<void>;
}
