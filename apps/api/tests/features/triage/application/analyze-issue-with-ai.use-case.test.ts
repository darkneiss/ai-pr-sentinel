import {
  AI_DUPLICATE_COMMENT_PREFIX,
  AI_QUESTION_FALLBACK_CHECKLIST,
  AI_QUESTION_FALLBACK_REPLY_COMMENT_PREFIX,
  AI_KIND_QUESTION_LABEL,
  AI_QUESTION_REPLY_COMMENT_PREFIX,
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

  it('should use configured github labels for AI kind relabeling', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    const config = {
      get: (key: string) => {
        if (key === 'AI_LABEL_KIND_BUG') return 'bug';
        if (key === 'AI_LABEL_KIND_FEATURE') return 'enhancement';
        if (key === 'AI_LABEL_KIND_QUESTION') return 'question';
        return undefined;
      },
      getBoolean: () => undefined,
    };
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
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway, config });

    // Act
    const result = await run(createInput({ issue: { ...createInput().issue, labels: ['bug'] } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.removeLabel).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      label: 'bug',
    });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      labels: ['question'],
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

  it('should use recent issue as duplicate fallback when AI marks duplicate with high similarity but no originalIssueNumber', async () => {
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
      body: expect.stringContaining(`${AI_DUPLICATE_COMMENT_PREFIX}10`),
    });
  });

  it('should build prompts from registry template when prompt gateway is provided', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    const issueTriagePromptGateway = {
      getPrompt: () => ({
        version: '1.0.0',
        provider: 'generic',
        systemPrompt: 'System prompt from registry',
        userPromptTemplate: 'Title: {{issue_title}}',
        config: { temperature: 0.42, maxTokens: 321 },
      }),
    };
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      issueTriagePromptGateway,
      governanceGateway,
    });

    // Act
    const result = await run(createInput());

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(llmGateway.generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: 'System prompt from registry',
        userPrompt: expect.stringContaining('Title: Login fails intermittently'),
        maxTokens: 321,
        temperature: 0.42,
      }),
    );
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

  it('should normalize legacy Gemini-like response format and execute governance actions', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: 'Question',
        duplicate_detection: {
          is_duplicate: true,
          duplicate_of: ['#123'],
        },
        tone: 'Aggressive',
      }),
    });
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway });

    // Act
    const result = await run(createInput({ issue: { ...createInput().issue, labels: [] } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      labels: [AI_KIND_QUESTION_LABEL],
    });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      labels: [AI_TRIAGE_DUPLICATE_LABEL],
    });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      labels: [AI_TRIAGE_MONITOR_LABEL],
    });
    expect(governanceGateway.createComment).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      body: expect.stringContaining(`${AI_DUPLICATE_COMMENT_PREFIX}123`),
    });
  });

  it('should select a duplicate reference different from current issue in legacy format', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: 'Bug',
        duplicate_detection: {
          is_duplicate: true,
          duplicate_of: ['#42', '#123'],
        },
        tone: 'neutral',
      }),
    });
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway });

    // Act
    const result = await run(createInput({ issue: { ...createInput().issue, labels: [] } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.createComment).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      body: expect.stringContaining(`${AI_DUPLICATE_COMMENT_PREFIX}123`),
    });
  });

  it('should log info and skip duplicate action when duplicate points to current issue only', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: 'Bug',
        duplicate_detection: {
          is_duplicate: true,
          duplicate_of: ['#42'],
        },
        tone: 'neutral',
      }),
    });
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
    const result = await run(createInput({ issue: { ...createInput().issue, labels: [] } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('should normalize legacy feature/positive response and parse numeric duplicate reference', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: 'FEATURE',
        duplicate_detection: {
          is_duplicate: true,
          duplicate_of: [200],
        },
        tone: 'positive',
      }),
    });
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway });

    // Act
    const result = await run(createInput({ issue: { ...createInput().issue, labels: [] } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      labels: ['kind/feature'],
    });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      labels: [AI_TRIAGE_DUPLICATE_LABEL],
    });
    expect(governanceGateway.createComment).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      body: expect.stringContaining(`${AI_DUPLICATE_COMMENT_PREFIX}200`),
    });
    expect(governanceGateway.addLabels).not.toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      labels: [AI_TRIAGE_MONITOR_LABEL],
    });
  });

  it('should skip labels when legacy classification is unknown and confidence becomes zero', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: 'incident',
        tone: 'neutral',
      }),
    });
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway });

    // Act
    const result = await run(createInput({ issue: { ...createInput().issue, labels: [] } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).not.toHaveBeenCalled();
    expect(governanceGateway.removeLabel).not.toHaveBeenCalled();
  });

  it('should skip duplicate action for invalid legacy references and non-string classification', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: { kind: 'bug' },
        duplicate_detection: {
          is_duplicate: true,
          duplicate_of: ['not-an-issue-number'],
        },
        tone: 'sarcastic',
      }),
    });
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
    const result = await run(createInput({ issue: { ...createInput().issue, labels: [] } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).not.toHaveBeenCalled();
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('should preserve legacy reasoning string when normalizing response', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: 'Question',
        reasoning: 'Legacy provider reasoning payload.',
        tone: 'neutral',
      }),
    });
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway });

    // Act
    const result = await run(createInput({ issue: { ...createInput().issue, labels: [] } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      labels: [AI_KIND_QUESTION_LABEL],
    });
  });

  it('should skip duplicate action when legacy duplicate reference is not number or string', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: 'Bug',
        duplicate_detection: {
          is_duplicate: true,
          duplicate_of: [{ issue: 123 }],
        },
        tone: 'neutral',
      }),
    });
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
    const result = await run(createInput({ issue: { ...createInput().issue, labels: [] } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('should parse legacy duplicate_of as string with text and add duplicate actions', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: 'Bug',
        duplicate_detection: {
          is_duplicate: true,
          duplicate_of: 'Possible duplicate: issue #6',
        },
        tone: 'neutral',
      }),
    });
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway });

    // Act
    const result = await run(createInput({ issue: { ...createInput().issue, labels: [] } }));

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
      body: expect.stringContaining(`${AI_DUPLICATE_COMMENT_PREFIX}6`),
    });
  });

  it('should parse legacy original_issue_number field and add duplicate actions', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: 'Bug',
        duplicate_detection: {
          is_duplicate: true,
          original_issue_number: 8,
        },
        tone: 'neutral',
      }),
    });
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway });

    // Act
    const result = await run(createInput({ issue: { ...createInput().issue, labels: [] } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.createComment).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      body: expect.stringContaining(`${AI_DUPLICATE_COMMENT_PREFIX}8`),
    });
  });

  it('should parse legacy duplicate_of object reference and add duplicate actions', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: 'Bug',
        duplicate_detection: {
          is_duplicate: true,
          duplicate_of: [{ number: 9 }],
        },
        tone: 'neutral',
      }),
    });
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway });

    // Act
    const result = await run(createInput({ issue: { ...createInput().issue, labels: [] } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.createComment).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      body: expect.stringContaining(`${AI_DUPLICATE_COMMENT_PREFIX}9`),
    });
  });

  it('should skip duplicate action when legacy duplicate reference is integer but not positive', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: 'Bug',
        duplicate_detection: {
          is_duplicate: true,
          duplicate_of: [0],
        },
        tone: 'neutral',
      }),
    });
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
    const result = await run(createInput({ issue: { ...createInput().issue, labels: [] } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('should create setup checklist comment for opened question issues with high confidence', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: {
          type: 'question',
          confidence: 0.95,
          reasoning: 'The user asks how to configure providers locally.',
        },
        duplicateDetection: {
          isDuplicate: false,
          originalIssueNumber: null,
          similarityScore: 0.1,
        },
        sentiment: {
          tone: 'neutral',
          reasoning: 'Neutral request.',
        },
        suggestedResponse: '- Set AI_TRIAGE_ENABLED=true\n- Configure LLM_PROVIDER and LLM_MODEL',
      }),
    });
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      governanceGateway,
      botLogin: 'ai-pr-sentinel[bot]',
    });

    // Act
    const result = await run(createInput({ action: 'opened', issue: { ...createInput().issue, labels: [] } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(issueHistoryGateway.hasIssueCommentWithPrefix).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      bodyPrefix: AI_QUESTION_REPLY_COMMENT_PREFIX,
      authorLogin: 'ai-pr-sentinel[bot]',
    });
    expect(governanceGateway.createComment).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      body: expect.stringContaining(AI_QUESTION_REPLY_COMMENT_PREFIX),
    });
  });

  it('should skip setup checklist comment when same bot comment already exists', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    issueHistoryGateway.hasIssueCommentWithPrefix.mockResolvedValueOnce(true);
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: {
          type: 'question',
          confidence: 0.95,
          reasoning: 'The user asks how to configure providers locally.',
        },
        duplicateDetection: {
          isDuplicate: false,
          originalIssueNumber: null,
          similarityScore: 0.1,
        },
        sentiment: {
          tone: 'neutral',
          reasoning: 'Neutral request.',
        },
        suggestedResponse: '- Set AI_TRIAGE_ENABLED=true',
      }),
    });
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      governanceGateway,
      botLogin: 'ai-pr-sentinel[bot]',
    });

    // Act
    const result = await run(createInput({ action: 'opened', issue: { ...createInput().issue, labels: [] } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.createComment).not.toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining(AI_QUESTION_REPLY_COMMENT_PREFIX),
      }),
    );
  });

  it('should not create setup checklist comment when action is edited', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: {
          type: 'question',
          confidence: 0.95,
          reasoning: 'Question issue.',
        },
        duplicateDetection: {
          isDuplicate: false,
          originalIssueNumber: null,
          similarityScore: 0.1,
        },
        sentiment: {
          tone: 'neutral',
          reasoning: 'Neutral request.',
        },
        suggestedResponse: '- Example checklist',
      }),
    });
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway });

    // Act
    const result = await run(createInput({ action: 'edited', issue: { ...createInput().issue, labels: [] } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(issueHistoryGateway.hasIssueCommentWithPrefix).not.toHaveBeenCalled();
  });

  it('should normalize legacy suggested_response and create setup checklist comment', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: 'Question',
        duplicate_detection: {
          is_duplicate: false,
        },
        tone: 'neutral',
        suggested_response: '- Run pnpm install\n- Set LLM_PROVIDER=gemini',
      }),
    });
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      governanceGateway,
    });

    // Act
    const result = await run(createInput({ action: 'opened', issue: { ...createInput().issue, labels: [] } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.createComment).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      body: expect.stringContaining('- Run pnpm install'),
    });
  });

  it('should normalize legacy suggestedResponse and create setup checklist comment', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: 'Question',
        duplicate_detection: {
          is_duplicate: false,
        },
        tone: 'neutral',
        suggestedResponse: '- Export API key\n- Start dev server',
      }),
    });
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      governanceGateway,
    });

    // Act
    const result = await run(createInput({ action: 'opened', issue: { ...createInput().issue, labels: [] } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.createComment).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      body: expect.stringContaining('- Export API key'),
    });
  });

  it('should create fallback checklist when issue looks like question and ai does not provide suggestedResponse', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: {
          type: 'bug',
          confidence: 0.95,
          reasoning: 'Model classified as bug.',
        },
        duplicateDetection: {
          isDuplicate: false,
          originalIssueNumber: null,
          similarityScore: 0.1,
        },
        sentiment: {
          tone: 'neutral',
          reasoning: 'Neutral tone.',
        },
      }),
    });
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway });

    // Act
    const result = await run(
      createInput({
        action: 'opened',
        issue: {
          ...createInput().issue,
          title: 'How can I configure Gemini locally?',
          body: 'I need help to run this project in local environment.',
          labels: [],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.createComment).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      body: `${AI_QUESTION_FALLBACK_REPLY_COMMENT_PREFIX}\n\n${AI_QUESTION_FALLBACK_CHECKLIST.join('\n')}`,
    });
  });

  it('should prioritize ai suggestedResponse over fallback checklist', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: {
          type: 'question',
          confidence: 0.95,
          reasoning: 'Question issue.',
        },
        duplicateDetection: {
          isDuplicate: false,
          originalIssueNumber: null,
          similarityScore: 0.1,
        },
        sentiment: {
          tone: 'neutral',
          reasoning: 'Neutral tone.',
        },
        suggestedResponse: '- Use LLM_PROVIDER=gemini\n- Start with pnpm --filter api dev',
      }),
    });
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway });

    // Act
    const result = await run(
      createInput({
        action: 'opened',
        issue: {
          ...createInput().issue,
          title: 'How can I configure Gemini locally?',
          body: 'I need help to run this project in local environment.',
          labels: [],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.createComment).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      body: expect.stringContaining('- Use LLM_PROVIDER=gemini'),
    });
    expect(governanceGateway.createComment).not.toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining(AI_QUESTION_FALLBACK_CHECKLIST[0]),
      }),
    );
  });

  it('should normalize structured provider response with duplicateIssueId and suggestedResponse array', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: {
          type: 'question',
          confidence: 0.95,
        },
        sentiment: {
          tone: 'neutral',
          confidence: 0.8,
        },
        duplicateDetection: {
          isDuplicate: true,
          similarityScore: 0.98,
          duplicateIssueId: 12,
        },
        suggestedResponse: [
          'Set up your local environment with dependencies.',
          'Configure environment variables for Gemini.',
          'Run local server and verify logs.',
        ],
      }),
    });
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      governanceGateway,
      botLogin: 'ai-pr-sentinel[bot]',
    });

    // Act
    const result = await run(
      createInput({
        action: 'opened',
        issue: {
          ...createInput().issue,
          number: 12,
          labels: [],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 12,
      labels: [AI_KIND_QUESTION_LABEL],
    });
    expect(governanceGateway.addLabels).not.toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 12,
      labels: [AI_TRIAGE_DUPLICATE_LABEL],
    });
    expect(governanceGateway.createComment).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 12,
      body: expect.stringContaining('Set up your local environment with dependencies.'),
    });
  });

  it('should ignore empty-string suggestedResponse after trim', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: {
          type: 'question',
          confidence: 0.95,
          reasoning: 'Question issue.',
        },
        duplicateDetection: {
          isDuplicate: false,
          originalIssueNumber: null,
          similarityScore: 0.1,
        },
        sentiment: {
          tone: 'neutral',
          reasoning: 'Neutral tone.',
        },
        suggestedResponse: '   ',
      }),
    });
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway });

    // Act
    const result = await run(
      createInput({
        action: 'opened',
        issue: {
          ...createInput().issue,
          title: 'General inquiry',
          body: 'Need guidance with setup details.',
          labels: [],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.createComment).not.toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining(AI_QUESTION_REPLY_COMMENT_PREFIX),
      }),
    );
  });

  it('should ignore non-string and non-array suggestedResponse values', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: {
          type: 'question',
          confidence: 0.95,
          reasoning: 'Question issue.',
        },
        duplicateDetection: {
          isDuplicate: false,
          originalIssueNumber: null,
          similarityScore: 0.1,
        },
        sentiment: {
          tone: 'neutral',
          reasoning: 'Neutral tone.',
        },
        suggestedResponse: 123,
      }),
    });
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway });

    // Act
    const result = await run(
      createInput({
        action: 'opened',
        issue: {
          ...createInput().issue,
          title: 'General inquiry',
          body: 'Need guidance with setup details.',
          labels: [],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.createComment).not.toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining(AI_QUESTION_REPLY_COMMENT_PREFIX),
      }),
    );
  });

  it('should normalize structured empty suggested_response string as undefined', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
        classification: {
          type: 'question',
          confidence: 0.95,
        },
        sentiment: {
          tone: 'neutral',
        },
        duplicateDetection: {
          isDuplicate: false,
          similarityScore: 0.1,
        },
        suggested_response: '   ',
      }),
    });
    const run = analyzeIssueWithAi({ llmGateway, issueHistoryGateway, governanceGateway });

    // Act
    const result = await run(
      createInput({
        action: 'opened',
        issue: {
          ...createInput().issue,
          title: 'General inquiry',
          body: 'Need guidance with setup details.',
          labels: [],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.createComment).not.toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining(AI_QUESTION_REPLY_COMMENT_PREFIX),
      }),
    );
  });
});
