import {
  resolveAiDecisionThresholds,
  resolveAiTemperature,
  resolveAiCurationConfidenceThresholds,
  resolveAiCurationLabels,
  resolveAiKindLabels,
  resolveAiTimeoutMs,
} from '../../../../../src/features/triage/application/constants/ai-triage.constants';

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

  it('should resolve default AI kind labels when env mapping is not configured', () => {
    // Arrange
    const config = {
      get: () => undefined,
      getBoolean: () => undefined,
    };

    // Act
    const result = resolveAiKindLabels(config);

    // Assert
    expect(result).toEqual({
      bugLabel: 'kind/bug',
      featureLabel: 'kind/feature',
      questionLabel: 'kind/question',
      kindLabels: ['kind/bug', 'kind/feature', 'kind/question'],
    });
  });

  it('should resolve AI kind labels from env mapping when configured', () => {
    // Arrange
    const config = {
      get: (key: string) => {
        if (key === 'AI_LABEL_KIND_BUG') return 'bug';
        if (key === 'AI_LABEL_KIND_FEATURE') return 'enhancement';
        if (key === 'AI_LABEL_KIND_QUESTION') return 'question';
        return undefined;
      },
      getBoolean: () => undefined,
    };

    // Act
    const result = resolveAiKindLabels(config);

    // Assert
    expect(result).toEqual({
      bugLabel: 'bug',
      featureLabel: 'enhancement',
      questionLabel: 'question',
      kindLabels: ['bug', 'enhancement', 'question'],
    });
  });

  it('should resolve default curation labels when mapping is not configured', () => {
    // Arrange
    const config = {
      get: () => undefined,
      getBoolean: () => undefined,
    };

    // Act
    const result = resolveAiCurationLabels(config);

    // Assert
    expect(result).toEqual({
      documentationLabel: 'documentation',
      helpWantedLabel: 'help wanted',
      goodFirstIssueLabel: 'good first issue',
    });
  });

  it('should resolve curation labels from env mapping when configured', () => {
    // Arrange
    const config = {
      get: (key: string) => {
        if (key === 'AI_LABEL_DOCUMENTATION') return 'docs';
        if (key === 'AI_LABEL_HELP_WANTED') return 'help wanted';
        if (key === 'AI_LABEL_GOOD_FIRST_ISSUE') return 'good first issue';
        return undefined;
      },
      getBoolean: () => undefined,
    };

    // Act
    const result = resolveAiCurationLabels(config);

    // Assert
    expect(result).toEqual({
      documentationLabel: 'docs',
      helpWantedLabel: 'help wanted',
      goodFirstIssueLabel: 'good first issue',
    });
  });

  it('should resolve default curation confidence thresholds when env vars are missing', () => {
    // Arrange
    const config = {
      get: () => undefined,
      getBoolean: () => undefined,
    };

    // Act
    const result = resolveAiCurationConfidenceThresholds(config);

    // Assert
    expect(result).toEqual({
      documentationConfidenceThreshold: 0.9,
      helpWantedConfidenceThreshold: 0.9,
      goodFirstIssueConfidenceThreshold: 0.95,
    });
  });

  it('should resolve curation confidence thresholds from env vars when configured', () => {
    // Arrange
    const config = {
      get: (key: string) => {
        if (key === 'AI_LABEL_DOCUMENTATION_CONFIDENCE_THRESHOLD') return '0.85';
        if (key === 'AI_LABEL_HELP_WANTED_CONFIDENCE_THRESHOLD') return '0.8';
        if (key === 'AI_LABEL_GOOD_FIRST_ISSUE_CONFIDENCE_THRESHOLD') return '0.9';
        return undefined;
      },
      getBoolean: () => undefined,
    };

    // Act
    const result = resolveAiCurationConfidenceThresholds(config);

    // Assert
    expect(result).toEqual({
      documentationConfidenceThreshold: 0.85,
      helpWantedConfidenceThreshold: 0.8,
      goodFirstIssueConfidenceThreshold: 0.9,
    });
  });

  it('should ignore invalid curation confidence threshold env vars', () => {
    // Arrange
    const config = {
      get: (key: string) => {
        if (key === 'AI_LABEL_DOCUMENTATION_CONFIDENCE_THRESHOLD') return '1.2';
        if (key === 'AI_LABEL_HELP_WANTED_CONFIDENCE_THRESHOLD') return '-0.1';
        if (key === 'AI_LABEL_GOOD_FIRST_ISSUE_CONFIDENCE_THRESHOLD') return 'not-a-number';
        return undefined;
      },
      getBoolean: () => undefined,
    };

    // Act
    const result = resolveAiCurationConfidenceThresholds(config);

    // Assert
    expect(result).toEqual({
      documentationConfidenceThreshold: 0.9,
      helpWantedConfidenceThreshold: 0.9,
      goodFirstIssueConfidenceThreshold: 0.95,
    });
  });

  it('should resolve default ai decision thresholds when env vars are missing', () => {
    // Arrange
    const config = {
      get: () => undefined,
      getBoolean: () => undefined,
    };

    // Act
    const result = resolveAiDecisionThresholds(config);

    // Assert
    expect(result).toEqual({
      classificationConfidenceThreshold: 0.8,
      sentimentConfidenceThreshold: 0.75,
      duplicateSimilarityThreshold: 0.85,
    });
  });

  it('should resolve ai decision thresholds from env vars when configured', () => {
    // Arrange
    const config = {
      get: (key: string) => {
        if (key === 'AI_CLASSIFICATION_CONFIDENCE_THRESHOLD') return '0.7';
        if (key === 'AI_SENTIMENT_CONFIDENCE_THRESHOLD') return '0.65';
        if (key === 'AI_DUPLICATE_SIMILARITY_THRESHOLD') return '0.9';
        return undefined;
      },
      getBoolean: () => undefined,
    };

    // Act
    const result = resolveAiDecisionThresholds(config);

    // Assert
    expect(result).toEqual({
      classificationConfidenceThreshold: 0.7,
      sentimentConfidenceThreshold: 0.65,
      duplicateSimilarityThreshold: 0.9,
    });
  });

  it('should ignore invalid ai decision threshold env vars', () => {
    // Arrange
    const config = {
      get: (key: string) => {
        if (key === 'AI_CLASSIFICATION_CONFIDENCE_THRESHOLD') return 'foo';
        if (key === 'AI_SENTIMENT_CONFIDENCE_THRESHOLD') return '-1';
        if (key === 'AI_DUPLICATE_SIMILARITY_THRESHOLD') return '1.5';
        return undefined;
      },
      getBoolean: () => undefined,
    };

    // Act
    const result = resolveAiDecisionThresholds(config);

    // Assert
    expect(result).toEqual({
      classificationConfidenceThreshold: 0.8,
      sentimentConfidenceThreshold: 0.75,
      duplicateSimilarityThreshold: 0.85,
    });
  });

  it('should resolve default ai temperature when env var is missing', () => {
    // Arrange
    const config = {
      get: () => undefined,
      getBoolean: () => undefined,
    };

    // Act
    const result = resolveAiTemperature(config);

    // Assert
    expect(result).toBe(0.1);
  });

  it('should resolve ai temperature from env var when configured', () => {
    // Arrange
    const config = {
      get: (key: string) => (key === 'AI_TEMPERATURE' ? '0.25' : undefined),
      getBoolean: () => undefined,
    };

    // Act
    const result = resolveAiTemperature(config);

    // Assert
    expect(result).toBe(0.25);
  });

  it('should ignore invalid ai temperature env var values', () => {
    // Arrange
    const config = {
      get: (key: string) => (key === 'AI_TEMPERATURE' ? '1.2' : undefined),
      getBoolean: () => undefined,
    };

    // Act
    const result = resolveAiTemperature(config);

    // Assert
    expect(result).toBe(0.1);
  });
});
