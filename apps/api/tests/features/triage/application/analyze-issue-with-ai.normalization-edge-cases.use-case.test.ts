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
    number: 30,
    title: 'App crashes on startup',
    body: 'The process exits immediately when launching in production mode.',
    labels: [],
  },
  ...overrides,
});

describe('AnalyzeIssueWithAiUseCase (Normalization Edge Cases)', () => {
  it('should accept already-valid AI shape without fallback normalizers', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest.fn().mockResolvedValue({
        rawText: JSON.stringify({
          classification: {
            type: 'bug',
            confidence: 0.91,
            reasoning: 'Reproducible failure in runtime behavior.',
          },
          duplicateDetection: {
            isDuplicate: false,
            originalIssueNumber: null,
            similarityScore: 0.1,
          },
          sentiment: {
            tone: 'neutral',
            confidence: 0.9,
            reasoning: 'Technical report without toxic language.',
          },
        }),
      }),
    };
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      governanceGateway,
    });

    // Act
    const result = await run(createInput());

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 30,
      labels: ['kind/bug'],
    });
  });

  it('should fail-open when structured payload omits duplicate shape entirely', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest.fn().mockResolvedValue({
        rawText: JSON.stringify({
          classification: {
            type: 'question',
            confidence: 0.9,
          },
          sentiment: {
            tone: 'neutral',
            confidence: 0.8,
          },
        }),
      }),
    };
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
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
    const result = await run(
      createInput({
        issue: {
          number: 55,
          title: 'How do I configure this project?',
          body: 'I need guidance to run this repository locally.',
          labels: [],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'skipped', reason: 'ai_unavailable' });
    expect(logger.error).toHaveBeenCalledWith(
      'AnalyzeIssueWithAiUseCase failed parsing AI response. Applying fail-open policy.',
      expect.objectContaining({
        repositoryFullName: 'org/repo',
        issueNumber: 55,
      }),
    );
  });

  it('should normalize classification similarity fallback without duplicate block', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest.fn().mockResolvedValue({
        rawText: JSON.stringify({
          classification: {
            type: 'question',
            confidence: 0.95,
            similarityScore: 0.92,
          },
          sentiment: {
            tone: 'neutral',
          },
          suggestedResponse:
            '- Este repositorio es un sandbox para probar AI-PR-Sentinel.\\n- Puedes crear issues de prueba.\\n- Revisa el README para escenarios.',
        }),
      }),
    };
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
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
        action: 'edited',
        issue: {
          number: 30,
          title: 'Que se puede hacer en este repositorio?',
          body: 'Me gustaría entender para qué sirve este proyecto.',
          labels: [],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 30,
      labels: ['kind/question'],
    });
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should normalize legacy classification-only response and publish question guidance', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest.fn().mockResolvedValue({
        rawText: JSON.stringify({
          classification: 'question',
          suggestedResponse: 'Check the README for setup guidance.',
        }),
      }),
    };
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      governanceGateway,
    });

    // Act
    const result = await run(
      createInput({
        issue: {
          number: 101,
          title: 'What is this repository for?',
          body: 'I want to understand the purpose before contributing.',
          labels: [],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: ['kind/question'],
      }),
    );
    expect(governanceGateway.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('Check the README for setup guidance.'),
      }),
    );
  });
});
