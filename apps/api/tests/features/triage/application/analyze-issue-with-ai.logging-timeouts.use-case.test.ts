import type { GovernanceGateway } from '../../../../src/features/triage/application/ports/governance-gateway.port';
import type { IssueHistoryGateway } from '../../../../src/features/triage/application/ports/issue-history-gateway.port';
import {
  analyzeIssueWithAi,
  type AnalyzeIssueWithAiInput,
} from '../../../../src/features/triage/application/use-cases/analyze-issue-with-ai.use-case';
import type { LLMGateway } from '../../../../src/shared/application/ports/llm-gateway.port';

const createLlmGatewayMock = (): jest.Mocked<LLMGateway> => ({
  generateJson: jest.fn().mockResolvedValue({
    rawText: JSON.stringify({
      classification: {
        type: 'bug',
        confidence: 0.95,
        reasoning: 'The issue reports a reproducible software failure.',
      },
      duplicateDetection: {
        isDuplicate: false,
        originalIssueNumber: null,
        similarityScore: 0.1,
        hasExplicitOriginalIssueReference: false,
      },
      sentiment: {
        tone: 'neutral',
        reasoning: 'The report is neutral and technical.',
      },
    }),
  }),
});

const createIssueHistoryGatewayMock = (): jest.Mocked<IssueHistoryGateway> => ({
  findRecentIssues: jest.fn().mockResolvedValue([
    {
      number: 10,
      title: 'Cannot login in Safari',
      labels: ['kind/bug'],
      state: 'open',
    },
  ]),
  hasIssueCommentWithPrefix: jest.fn().mockResolvedValue(false),
});

const createGovernanceGatewayMock = (): jest.Mocked<GovernanceGateway> => ({
  addLabels: jest.fn().mockResolvedValue(undefined),
  removeLabel: jest.fn().mockResolvedValue(undefined),
  createComment: jest.fn().mockResolvedValue(undefined),
  logValidatedIssue: jest.fn().mockResolvedValue(undefined),
});

const createInput = (overrides: Partial<AnalyzeIssueWithAiInput> = {}): AnalyzeIssueWithAiInput => ({
  action: 'opened',
  repositoryFullName: 'org/repo',
  issue: {
    number: 42,
    title: 'Login fails intermittently',
    body: 'Users report intermittent auth failures in mobile browsers after one hour.',
    labels: ['kind/bug'],
  },
  ...overrides,
});

describe('AnalyzeIssueWithAiUseCase (Logging + Timeout)', () => {
  it('should use LLM_TIMEOUT override when configured', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    const config = {
      get: (key: string) => (key === 'LLM_TIMEOUT' ? '300000' : undefined),
      getBoolean: () => undefined,
    };
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway, config });

    // Act
    const result = await run(createInput());

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(llmGateway.generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        timeoutMs: 300000,
      }),
    );
  });

  it('should default to the ollama timeout when provider is ollama and no override is set', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    const config = {
      get: (key: string) => (key === 'LLM_PROVIDER' ? 'ollama' : undefined),
      getBoolean: () => undefined,
    };
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway, config });

    // Act
    const result = await run(createInput());

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(llmGateway.generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        timeoutMs: 240000,
      }),
    );
  });

  it('should fail open when llm provider fails', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockRejectedValueOnce(new Error('provider unavailable'));
    const logger = {
      error: jest.fn(),
    };
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      governanceGateway,
      logger,
    });

    // Act
    const result = await run(createInput({ action: 'edited' }));

    // Assert
    expect(result).toEqual({ status: 'skipped', reason: 'ai_unavailable' });
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('should fail open when ai response is invalid json', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({ rawText: '{invalid-json' });
    const logger = {
      error: jest.fn(),
    };
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      governanceGateway,
      logger,
    });

    // Act
    const result = await run(createInput());

    // Assert
    expect(result).toEqual({ status: 'skipped', reason: 'ai_unavailable' });
    expect(logger.error).toHaveBeenCalledTimes(1);
    const loggerCallContext = logger.error.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(loggerCallContext.rawTextLength).toBe('{invalid-json'.length);
    expect(loggerCallContext.rawText).toBeUndefined();
    expect(governanceGateway.addLabels).not.toHaveBeenCalled();
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
  });

  it('should not log raw ai response when debug logging is disabled', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({ rawText: '{invalid-json' });
    const logger = {
      error: jest.fn(),
    };
    const config = {
      get: () => undefined,
      getBoolean: () => undefined,
    };
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      governanceGateway,
      logger,
      config,
    });

    // Act
    const result = await run(createInput());

    // Assert
    expect(result).toEqual({ status: 'skipped', reason: 'ai_unavailable' });
    const loggerCallContext = logger.error.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(loggerCallContext.rawTextLength).toBe('{invalid-json'.length);
    expect(loggerCallContext.rawTextPreview).toBeUndefined();
  });

  it('should log truncated raw ai response when debug logging is enabled', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    const longRawText = 'x'.repeat(5000);
    llmGateway.generateJson.mockResolvedValueOnce({ rawText: longRawText });
    const logger = {
      error: jest.fn(),
    };
    const config = {
      get: (key: string) => (key === 'NODE_ENV' ? 'development' : undefined),
      getBoolean: (key: string) => (key === 'LLM_LOG_RAW_RESPONSE' ? true : undefined),
    };
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      governanceGateway,
      logger,
      config,
    });

    // Act
    const result = await run(createInput());

    // Assert
    expect(result).toEqual({ status: 'skipped', reason: 'ai_unavailable' });
    const loggerCallContext = logger.error.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(loggerCallContext.rawTextLength).toBe(5000);
    expect(typeof loggerCallContext.rawTextPreview).toBe('string');
    expect((loggerCallContext.rawTextPreview as string).length).toBe(2000);
  });

  it('should not log raw ai response in production even when enabled', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({ rawText: '{invalid-json' });
    const logger = {
      error: jest.fn(),
    };
    const config = {
      get: (key: string) => (key === 'NODE_ENV' ? 'production' : undefined),
      getBoolean: (key: string) => (key === 'LLM_LOG_RAW_RESPONSE' ? true : undefined),
    };
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      governanceGateway,
      logger,
      config,
    });

    // Act
    const result = await run(createInput());

    // Assert
    expect(result).toEqual({ status: 'skipped', reason: 'ai_unavailable' });
    const loggerCallContext = logger.error.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(loggerCallContext.rawTextLength).toBe('{invalid-json'.length);
    expect(loggerCallContext.rawTextPreview).toBeUndefined();
  });

  it('should fail open when ai response is valid json but not an object', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({ rawText: '"hello"' });
    const logger = {
      error: jest.fn(),
    };
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      governanceGateway,
      logger,
    });

    // Act
    const result = await run(createInput());

    // Assert
    expect(result).toEqual({ status: 'skipped', reason: 'ai_unavailable' });
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('should fail open when ai response object misses required nested structure', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: 'bug',
        duplicateDetection: {},
        sentiment: {},
      }),
    });
    const logger = {
      error: jest.fn(),
    };
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      governanceGateway,
      logger,
    });

    // Act
    const result = await run(createInput());

    // Assert
    expect(result).toEqual({ status: 'skipped', reason: 'ai_unavailable' });
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('should fail open when governance actions fail', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    governanceGateway.addLabels.mockRejectedValueOnce(new Error('github api error'));
    const logger = {
      error: jest.fn(),
    };
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      governanceGateway,
      logger,
    });
    const input = createInput({
      issue: {
        ...createInput().issue,
        labels: [],
      },
    });

    // Act
    const result = await run(input);

    // Assert
    expect(result).toEqual({ status: 'skipped', reason: 'ai_unavailable' });
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
