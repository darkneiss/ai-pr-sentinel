import { isRetryableTimeoutError } from '../../../../../src/shared/infrastructure/ai/adapters/retryable-timeout-error.guard';

describe('RetryableTimeoutErrorGuard', () => {
  it('should return false for non-error values', () => {
    // Arrange
    const nonErrorValue = { name: 'AbortError' };

    // Act
    const result = isRetryableTimeoutError(nonErrorValue);

    // Assert
    expect(result).toBe(false);
  });

  it('should return true for abort errors', () => {
    // Arrange
    const abortError = new Error('request aborted');
    abortError.name = 'AbortError';

    // Act
    const result = isRetryableTimeoutError(abortError);

    // Assert
    expect(result).toBe(true);
  });

  it('should return true for timeout errors', () => {
    // Arrange
    const timeoutError = new Error('request timed out');
    timeoutError.name = 'TimeoutError';

    // Act
    const result = isRetryableTimeoutError(timeoutError);

    // Assert
    expect(result).toBe(true);
  });

  it('should return false for non-timeout errors', () => {
    // Arrange
    const genericError = new Error('boom');
    genericError.name = 'TypeError';

    // Act
    const result = isRetryableTimeoutError(genericError);

    // Assert
    expect(result).toBe(false);
  });
});
