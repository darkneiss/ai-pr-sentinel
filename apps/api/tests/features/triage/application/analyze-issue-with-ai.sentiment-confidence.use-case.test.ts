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
    number: 21,
    title: 'Duda sobre la arquitectura',
    body: 'No entiendo por qué este repo parece hecho con el culo.',
    labels: [],
  },
  ...overrides,
});

describe('AnalyzeIssueWithAiUseCase (Sentiment Confidence)', () => {
  it('should trust high-confidence neutral sentiment and avoid hostile fallback labels', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest.fn().mockResolvedValue({
        rawText: JSON.stringify({
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
    expect(governanceGateway.addLabels).not.toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 21,
      labels: ['triage/monitor'],
    });
  });

  it('should apply monitor label on high-confidence hostile sentiment even without keyword match', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest.fn().mockResolvedValue({
        rawText: JSON.stringify({
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
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest.fn().mockResolvedValue({
        rawText: JSON.stringify({
          classification: 'question',
          tone: 'neutral',
          confidence: 0.95,
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
          number: 23,
          title: 'Consulta general',
          body: 'Esto parece hecho con el culo, pero quiero ayuda con el setup.',
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
