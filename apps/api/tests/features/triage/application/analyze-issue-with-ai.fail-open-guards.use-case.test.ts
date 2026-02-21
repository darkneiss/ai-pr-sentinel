import type { GovernanceGateway } from '../../../../src/features/triage/application/ports/governance-gateway.port';
import type { IssueHistoryGateway } from '../../../../src/features/triage/application/ports/issue-history-gateway.port';
import {
  AI_TRIAGE_DEFERRED_COMMENT_BODY,
  AI_TRIAGE_DEFERRED_COMMENT_PREFIX,
  AI_TRIAGE_DEFERRED_LABEL,
} from '../../../../src/features/triage/application/constants/ai-triage.constants';
import {
  analyzeIssueWithAi,
  type AnalyzeIssueWithAiInput,
} from '../../../../src/features/triage/application/use-cases/analyze-issue-with-ai.use-case';
import type { LLMGateway } from '../../../../src/shared/application/ports/llm-gateway.port';

const createIssueHistoryGatewayMock = (): jest.Mocked<IssueHistoryGateway> => ({
  findRecentIssues: jest.fn().mockResolvedValue([]),
  hasIssueCommentWithPrefix: jest.fn().mockResolvedValue(false),
});

const createInput = (overrides: Partial<AnalyzeIssueWithAiInput> = {}): AnalyzeIssueWithAiInput => ({
  action: 'opened',
  repositoryFullName: 'org/repo',
  issue: {
    number: 88,
    title: 'Esto es una mierda',
    body: 'No tienes ni idea de lo que haces.',
    labels: [],
  },
  ...overrides,
});

describe('AnalyzeIssueWithAiUseCase (Fail-open Guards)', () => {
  it('should mark issue as deferred when AI provider hits rate limit or quota', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest
        .fn()
        .mockRejectedValue(new Error('Gemini request failed with status 429 for model gemini-1.5-flash: quota exceeded')),
    };
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway: jest.Mocked<GovernanceGateway> = {
      addLabels: jest.fn().mockResolvedValue(undefined),
      removeLabel: jest.fn().mockResolvedValue(undefined),
      createComment: jest.fn().mockResolvedValue(undefined),
      logValidatedIssue: jest.fn().mockResolvedValue(undefined),
    };
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
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
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 88,
      labels: [AI_TRIAGE_DEFERRED_LABEL],
    });
    expect(issueHistoryGateway.hasIssueCommentWithPrefix).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 88,
      bodyPrefix: AI_TRIAGE_DEFERRED_COMMENT_PREFIX,
      authorLogin: undefined,
    });
    expect(governanceGateway.createComment).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 88,
      body: AI_TRIAGE_DEFERRED_COMMENT_BODY,
    });
  });

  it('should avoid duplicate deferred markers when label and comment already exist', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest
        .fn()
        .mockRejectedValue(new Error('Groq request failed with status 429 for model gpt at endpoint: rate limit exceeded')),
    };
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    issueHistoryGateway.hasIssueCommentWithPrefix.mockResolvedValue(true);
    const governanceGateway: jest.Mocked<GovernanceGateway> = {
      addLabels: jest.fn().mockResolvedValue(undefined),
      removeLabel: jest.fn().mockResolvedValue(undefined),
      createComment: jest.fn().mockResolvedValue(undefined),
      logValidatedIssue: jest.fn().mockResolvedValue(undefined),
    };
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
    };
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      governanceGateway,
      logger,
    });

    // Act
    const result = await run(
      createInput({
        issue: {
          number: 88,
          title: 'Esto es una mierda',
          body: 'No tienes ni idea de lo que haces.',
          labels: [AI_TRIAGE_DEFERRED_LABEL],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'skipped', reason: 'ai_unavailable' });
    expect(governanceGateway.addLabels).not.toHaveBeenCalled();
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
  });

  it('should remove deferred label after AI triage succeeds on a later retry', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
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
    };
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway: jest.Mocked<GovernanceGateway> = {
      addLabels: jest.fn().mockResolvedValue(undefined),
      removeLabel: jest.fn().mockResolvedValue(undefined),
      createComment: jest.fn().mockResolvedValue(undefined),
      logValidatedIssue: jest.fn().mockResolvedValue(undefined),
    };
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
    };
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      governanceGateway,
      logger,
    });

    // Act
    const result = await run(
      createInput({
        issue: {
          number: 88,
          title: 'Esto es una mierda',
          body: 'No tienes ni idea de lo que haces.',
          labels: [AI_TRIAGE_DEFERRED_LABEL],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.removeLabel).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 88,
      label: AI_TRIAGE_DEFERRED_LABEL,
    });
  });

  it('should mark issue as deferred when provider returns rate-limit error as string', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest.fn().mockRejectedValue('status 429: too many requests'),
    };
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway: jest.Mocked<GovernanceGateway> = {
      addLabels: jest.fn().mockResolvedValue(undefined),
      removeLabel: jest.fn().mockResolvedValue(undefined),
      createComment: jest.fn().mockResolvedValue(undefined),
      logValidatedIssue: jest.fn().mockResolvedValue(undefined),
    };
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
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
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 88,
      labels: [AI_TRIAGE_DEFERRED_LABEL],
    });
  });

  it('should mark issue as deferred when provider error has object message shape', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest.fn().mockRejectedValue({ message: 'rate limit exceeded' }),
    };
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway: jest.Mocked<GovernanceGateway> = {
      addLabels: jest.fn().mockResolvedValue(undefined),
      removeLabel: jest.fn().mockResolvedValue(undefined),
      createComment: jest.fn().mockResolvedValue(undefined),
      logValidatedIssue: jest.fn().mockResolvedValue(undefined),
    };
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
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
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 88,
      labels: [AI_TRIAGE_DEFERRED_LABEL],
    });
  });

  it('should skip deferred markers when provider error has no usable message', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest.fn().mockRejectedValue({ message: 429 }),
    };
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway: jest.Mocked<GovernanceGateway> = {
      addLabels: jest.fn().mockResolvedValue(undefined),
      removeLabel: jest.fn().mockResolvedValue(undefined),
      createComment: jest.fn().mockResolvedValue(undefined),
      logValidatedIssue: jest.fn().mockResolvedValue(undefined),
    };
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
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
    expect(governanceGateway.addLabels).not.toHaveBeenCalled();
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
  });

  it('should skip deferred markers when provider error object has no message field', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest.fn().mockRejectedValue({ status: 429 }),
    };
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway: jest.Mocked<GovernanceGateway> = {
      addLabels: jest.fn().mockResolvedValue(undefined),
      removeLabel: jest.fn().mockResolvedValue(undefined),
      createComment: jest.fn().mockResolvedValue(undefined),
      logValidatedIssue: jest.fn().mockResolvedValue(undefined),
    };
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
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
    expect(governanceGateway.addLabels).not.toHaveBeenCalled();
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
  });

  it('should keep fail-open when deferred marker write fails after capacity error', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest.fn().mockRejectedValue(new Error('Ollama request failed with status 429')),
    };
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway: jest.Mocked<GovernanceGateway> = {
      addLabels: jest.fn().mockRejectedValue(new Error('github write failed')),
      removeLabel: jest.fn().mockResolvedValue(undefined),
      createComment: jest.fn().mockResolvedValue(undefined),
      logValidatedIssue: jest.fn().mockResolvedValue(undefined),
    };
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
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
    expect(logger.error).toHaveBeenCalledWith(
      'AnalyzeIssueWithAiUseCase failed marking deferred AI triage state.',
      expect.objectContaining({
        repositoryFullName: 'org/repo',
        issueNumber: 88,
      }),
    );
  });

  it('should keep fail-open skipped when AI provider fails', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest.fn().mockRejectedValue(new Error('provider blocked response')),
    };
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway: jest.Mocked<GovernanceGateway> = {
      addLabels: jest.fn().mockResolvedValue(undefined),
      removeLabel: jest.fn().mockResolvedValue(undefined),
      createComment: jest.fn().mockResolvedValue(undefined),
      logValidatedIssue: jest.fn().mockResolvedValue(undefined),
    };
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
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
    expect(governanceGateway.addLabels).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('should keep fail-open skipped and avoid governance writes when provider fails', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest.fn().mockRejectedValue(new Error('provider blocked response')),
    };
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway: jest.Mocked<GovernanceGateway> = {
      addLabels: jest.fn().mockRejectedValue(new Error('github write failed')),
      removeLabel: jest.fn().mockResolvedValue(undefined),
      createComment: jest.fn().mockResolvedValue(undefined),
      logValidatedIssue: jest.fn().mockResolvedValue(undefined),
    };
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
    };
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      governanceGateway,
      logger,
    });

    // Act
    const result = await run(
      createInput({
        issue: {
          number: 89,
          title: 'Esto es una mierda',
          body: 'No tienes ni idea de lo que haces.',
          labels: [],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'skipped', reason: 'ai_unavailable' });
    expect(governanceGateway.addLabels).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
