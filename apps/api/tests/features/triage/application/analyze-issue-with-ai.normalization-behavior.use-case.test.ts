import type { GovernanceGateway } from '../../../../src/features/triage/application/ports/governance-gateway.port';
import type { IssueHistoryGateway } from '../../../../src/features/triage/application/ports/issue-history-gateway.port';
import {
  analyzeIssueWithAi,
  type AnalyzeIssueWithAiInput,
} from '../../../../src/features/triage/application/use-cases/analyze-issue-with-ai.use-case';
import type { LLMGateway } from '../../../../src/shared/application/ports/llm-gateway.port';

const createIssueHistoryGatewayMock = (): jest.Mocked<IssueHistoryGateway> => ({
  findRecentIssues: jest.fn().mockResolvedValue([]),
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
    title: 'Issue title',
    body: 'Issue body',
    labels: [],
  },
  ...overrides,
});

const createRun = (rawText: string) => {
  const llmGateway: jest.Mocked<LLMGateway> = {
    generateJson: jest.fn().mockResolvedValue({ rawText }),
  };
  const issueHistoryGateway = createIssueHistoryGatewayMock();
  const governanceGateway = createGovernanceGatewayMock();
  const logger = {
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };

  return {
    run: analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      governanceGateway,
      logger,
    }),
    governanceGateway,
    logger,
  };
};

describe('AnalyzeIssueWithAiUseCase (Normalization Behavior)', () => {
  it('should normalize structured response with fallback confidences and suggestedResponse array', async () => {
    // Arrange
    const { run, governanceGateway } = createRun(
      JSON.stringify({
        classification: {
          type: 'bug',
          confidence: 'high',
        },
        duplicateDetection: {
          isDuplicate: true,
          originalIssueNumber: 99,
          similarityScore: 'high',
        },
        sentiment: {
          tone: 'neutral',
        },
        suggestedResponse: [' Step one ', 'Step two'],
      }),
    );

    // Act
    const result = await run(createInput());

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      labels: ['kind/bug'],
    });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      labels: ['triage/duplicate'],
    });
    expect(governanceGateway.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('Possible duplicate of #99'),
      }),
    );
  });

  it('should fallback to bug type and ignore blank suggestedResponse in structured response', async () => {
    // Arrange
    const { run, governanceGateway } = createRun(
      JSON.stringify({
        classification: {
          type: 'incident',
          confidence: 'unknown',
        },
        duplicateDetection: {
          isDuplicate: false,
          similarityScore: 'unknown',
        },
        sentiment: {
          tone: 'neutral',
        },
        suggestedResponse: '   ',
      }),
    );

    // Act
    const result = await run(createInput());

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).not.toHaveBeenCalled();
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
  });

  it('should normalize non-empty suggestedResponse string and fallback unknown tone to neutral', async () => {
    // Arrange
    const { run, governanceGateway } = createRun(
      JSON.stringify({
        classification: {
          type: 'bug',
          confidence: 'high',
        },
        duplicateDetection: {
          isDuplicate: false,
          similarityScore: 'unknown',
        },
        sentiment: {
          tone: 'angry',
        },
        suggestedResponse: 'Use pnpm install first',
      }),
    );

    // Act
    const result = await run(
      createInput({
        issue: {
          number: 52,
          title: 'How can I configure env vars?',
          body: 'Need setup checklist for local execution',
          labels: [],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 52,
      labels: ['kind/bug'],
    });
  });

  it('should normalize suggestedResponse array and create question response comment', async () => {
    // Arrange
    const { run, governanceGateway } = createRun(
      JSON.stringify({
        classification: {
          type: 'question',
          confidence: 'high',
        },
        duplicateDetection: {
          isDuplicate: false,
          similarityScore: 'unknown',
        },
        sentiment: {
          tone: 'neutral',
        },
        suggestedResponse: ['Step 1: install dependencies', 'Step 2: configure .env'],
      }),
    );

    // Act
    const result = await run(
      createInput({
        issue: {
          number: 53,
          title: 'How can I configure env vars?',
          body: 'Need setup checklist for local execution',
          labels: [],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('Step 1: install dependencies\nStep 2: configure .env'),
      }),
    );
  });

  it('should accept tone.sentiment and similarIssueId aliases and suppress kind labels on hostile sentiment', async () => {
    // Arrange
    const { run, governanceGateway, logger } = createRun(
      '{"classification":{"type":"bug","confidence":0.9},"duplicateDetection":{"isDuplicate":true,"similarIssueId":32,"similarityScore":0.95},"tone":{"sentiment":"hostile","confidence":0.95},"suggestedResponse":""}',
    );

    // Act
    const result = await run(
      createInput({
        issue: {
          number: 32,
          title: 'offensive title',
          body: 'insult without explicit profanity',
          labels: [],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 32,
      labels: ['triage/monitor'],
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should trust high-confidence neutral sentiment and avoid hostile fallback labels', async () => {
    // Arrange
    const { run, governanceGateway } = createRun(
      JSON.stringify({
        classification: {
          type: 'question',
          confidence: 0.9,
        },
        duplicateDetection: {
          isDuplicate: false,
          originalIssueNumber: null,
          similarityScore: 0.1,
        },
        sentiment: {
          tone: 'neutral',
          confidence: 0.95,
        },
      }),
    );

    // Act
    const result = await run(
      createInput({
        issue: {
          number: 21,
          title: 'Duda sobre la arquitectura',
          body: 'No entiendo por que este repo parece mal construido.',
          labels: [],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).not.toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 21,
      labels: ['triage/monitor'],
    });
  });

  it('should apply monitor label on high-confidence hostile sentiment even without keyword match', async () => {
    // Arrange
    const { run, governanceGateway } = createRun(
      JSON.stringify({
        classification: {
          type: 'bug',
          confidence: 0.9,
        },
        duplicateDetection: {
          isDuplicate: false,
          originalIssueNumber: null,
          similarityScore: 0.1,
        },
        sentiment: {
          tone: 'hostile',
          confidence: 0.92,
        },
      }),
    );

    // Act
    const result = await run(
      createInput({
        issue: {
          number: 22,
          title: 'Issue review',
          body: 'Your review style is dismissive and disrespectful.',
          labels: [],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 22,
      labels: ['triage/monitor'],
    });
  });

  it('should honor legacy top-level confidence for sentiment fallback decisions', async () => {
    // Arrange
    const { run, governanceGateway } = createRun(
      JSON.stringify({
        classification: 'question',
        tone: 'neutral',
        confidence: 0.95,
      }),
    );

    // Act
    const result = await run(
      createInput({
        issue: {
          number: 23,
          title: 'Consulta general',
          body: 'Necesito ayuda con el setup.',
          labels: [],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).not.toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 23,
      labels: ['triage/monitor'],
    });
  });
});
