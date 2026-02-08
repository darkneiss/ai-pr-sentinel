export interface CreateGroqLlmAdapterParams {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
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
