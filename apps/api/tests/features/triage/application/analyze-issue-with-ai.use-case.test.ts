import {
  AI_DUPLICATE_COMMENT_PREFIX,
  AI_KIND_QUESTION_LABEL,
  AI_RECENT_ISSUES_LIMIT,
  AI_TRIAGE_DUPLICATE_LABEL,
  AI_TRIAGE_MONITOR_LABEL,
} from '../../../../src/features/triage/application/constants/ai-triage.constants';
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

describe('AnalyzeIssueWithAiUseCase', () => {
  it('should skip unsupported actions without calling gateways', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway });

    // Act
    const result = await run(
      createInput({
        action: 'deleted',
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'skipped', reason: 'unsupported_action' });
    expect(issueHistoryGateway.findRecentIssues).not.toHaveBeenCalled();
    expect(llmGateway.generateJson).not.toHaveBeenCalled();
    expect(governanceGateway.addLabels).not.toHaveBeenCalled();
  });

  it('should fetch recent issues and call llm when action is supported', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway });

    // Act
    const result = await run(createInput());

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(issueHistoryGateway.findRecentIssues).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      limit: AI_RECENT_ISSUES_LIMIT,
    });
    expect(llmGateway.generateJson).toHaveBeenCalledTimes(1);
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

  it('should include "(none)" in prompt when there are no recent issues', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    issueHistoryGateway.findRecentIssues.mockResolvedValueOnce([]);
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway });

    // Act
    const result = await run(createInput());

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(llmGateway.generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        userPrompt: expect.stringContaining('(none)'),
      }),
    );
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
    expect(governanceGateway.addLabels).not.toHaveBeenCalled();
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
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

  it('should relabel kind when classification is confident and conflicts with current labels', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: {
          type: 'question',
          confidence: 0.93,
          reasoning: 'This is a usage question, not a defect.',
        },
        duplicateDetection: {
          isDuplicate: false,
          originalIssueNumber: null,
          similarityScore: 0.1,
        },
        sentiment: {
          tone: 'neutral',
          reasoning: 'Tone is neutral.',
        },
      }),
    });
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway });

    // Act
    const result = await run(createInput({ issue: { ...createInput().issue, labels: ['kind/bug'] } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.removeLabel).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      label: 'kind/bug',
    });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      labels: [AI_KIND_QUESTION_LABEL],
    });
  });

  it('should map feature classification to kind/feature label', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: {
          type: 'feature',
          confidence: 0.95,
          reasoning: 'This asks for a product capability extension.',
        },
        duplicateDetection: {
          isDuplicate: false,
          originalIssueNumber: null,
          similarityScore: 0.1,
        },
        sentiment: {
          tone: 'neutral',
          reasoning: 'Tone is neutral.',
        },
      }),
    });
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway });

    // Act
    const result = await run(createInput({ issue: { ...createInput().issue, labels: ['kind/bug'] } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      labels: ['kind/feature'],
    });
  });

  it('should skip kind relabel when classification confidence is low', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: {
          type: 'question',
          confidence: 0.3,
          reasoning: 'Low confidence classification.',
        },
        duplicateDetection: {
          isDuplicate: false,
          originalIssueNumber: null,
          similarityScore: 0.1,
        },
        sentiment: {
          tone: 'neutral',
          reasoning: 'Tone is neutral.',
        },
      }),
    });
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway });

    // Act
    const result = await run(createInput());

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.removeLabel).not.toHaveBeenCalled();
  });

  it('should add duplicate label and comment when duplicate confidence is high', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: {
          type: 'bug',
          confidence: 0.95,
          reasoning: 'The issue reports a reproducible software failure.',
        },
        duplicateDetection: {
          isDuplicate: true,
          originalIssueNumber: 123,
          similarityScore: 0.91,
        },
        sentiment: {
          tone: 'neutral',
          reasoning: 'Tone is neutral.',
        },
      }),
    });
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway });

    // Act
    const result = await run(createInput({ issue: { ...createInput().issue, labels: ['kind/bug'] } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      labels: [AI_TRIAGE_DUPLICATE_LABEL],
    });
    expect(governanceGateway.createComment).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      body: expect.stringContaining(`${AI_DUPLICATE_COMMENT_PREFIX}123`),
    });
  });

  it('should avoid duplicate comment when duplicate label already exists', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: {
          type: 'bug',
          confidence: 0.95,
          reasoning: 'The issue reports a reproducible software failure.',
        },
        duplicateDetection: {
          isDuplicate: true,
          originalIssueNumber: 123,
          similarityScore: 0.91,
        },
        sentiment: {
          tone: 'neutral',
          reasoning: 'Tone is neutral.',
        },
      }),
    });
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway });

    // Act
    const result = await run(
      createInput({
        issue: { ...createInput().issue, labels: ['kind/bug', AI_TRIAGE_DUPLICATE_LABEL] },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
  });

  it('should add monitor label when sentiment is hostile', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
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
        },
        sentiment: {
          tone: 'hostile',
          reasoning: 'Contains hostile language.',
        },
      }),
    });
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway });

    // Act
    const result = await run(createInput({ issue: { ...createInput().issue, labels: ['kind/bug'] } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      labels: [AI_TRIAGE_MONITOR_LABEL],
    });
  });
});
