const ABORT_ERROR_NAME = 'AbortError';
const TIMEOUT_ERROR_NAME = 'TimeoutError';
const RETRYABLE_TIMEOUT_ERROR_NAMES = [ABORT_ERROR_NAME, TIMEOUT_ERROR_NAME] as const;

export const isRetryableTimeoutError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return (RETRYABLE_TIMEOUT_ERROR_NAMES as readonly string[]).includes(error.name);
};
