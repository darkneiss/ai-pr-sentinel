import type { ConfigPort } from '../../../application/ports/config.port';

export interface CreateGroqLlmAdapterParams {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
  config?: ConfigPort;
}

export interface GroqSuccessResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

export interface GroqErrorResponse {
  error?: {
    message?: string;
  };
  message?: string;
}

export interface GroqErrorContext {
  status: number;
  providerErrorMessage?: string;
}
