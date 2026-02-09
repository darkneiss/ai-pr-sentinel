import { resolveAiTimeoutMs } from '../../../../../src/features/triage/application/constants/ai-triage.constants';

describe('ai-triage.constants', () => {
  it('should use the global timeout override when provided', () => {
    // Arrange
    const config = {
      get: (key: string) => (key === 'LLM_TIMEOUT' ? '180000' : undefined),
      getBoolean: () => undefined,
    };

    // Act
    const result = resolveAiTimeoutMs(config);

    // Assert
    expect(result).toBe(180000);
  });

  it('should ignore invalid timeout override values', () => {
    // Arrange
    const config = {
      get: (key: string) => {
        if (key === 'LLM_TIMEOUT') return 'not-a-number';
        if (key === 'LLM_PROVIDER') return 'gemini';
        return undefined;
      },
      getBoolean: () => undefined,
    };

    // Act
    const result = resolveAiTimeoutMs(config);

    // Assert
    expect(result).toBe(120000);
  });

  it('should fall back to default timeout for unknown providers', () => {
    // Arrange
    const config = {
      get: (key: string) => (key === 'LLM_PROVIDER' ? 'unknown' : undefined),
      getBoolean: () => undefined,
    };

    // Act
    const result = resolveAiTimeoutMs(config);

    // Assert
    expect(result).toBe(120000);
  });

  it('should use ollama timeout when provider is ollama', () => {
    // Arrange
    const config = {
      get: (key: string) => (key === 'LLM_PROVIDER' ? 'ollama' : undefined),
      getBoolean: () => undefined,
    };

    // Act
    const result = resolveAiTimeoutMs(config);

    // Assert
    expect(result).toBe(240000);
  });

  it('should use groq timeout when provider is groq', () => {
    // Arrange
    const config = {
      get: (key: string) => (key === 'LLM_PROVIDER' ? 'groq' : undefined),
      getBoolean: () => undefined,
    };

    // Act
    const result = resolveAiTimeoutMs(config);

    // Assert
    expect(result).toBe(120000);
  });

  it('should default to ollama timeout when provider is not configured', () => {
    // Arrange
    const config = {
      get: () => undefined,
      getBoolean: () => undefined,
    };

    // Act
    const result = resolveAiTimeoutMs(config);

    // Assert
    expect(result).toBe(240000);
  });

  it('should truncate decimal timeout overrides', () => {
    // Arrange
    const config = {
      get: (key: string) => (key === 'LLM_TIMEOUT' ? '1234.9' : undefined),
      getBoolean: () => undefined,
    };

    // Act
    const result = resolveAiTimeoutMs(config);

    // Assert
    expect(result).toBe(1234);
  });
});
