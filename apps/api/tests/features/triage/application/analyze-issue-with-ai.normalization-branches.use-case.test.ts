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
        reasoning: 'Bug report',
      },
      duplicateDetection: {
        isDuplicate: false,
        originalIssueNumber: null,
        similarityScore: 0.1,
      },
      sentiment: {
        tone: 'neutral',
        reasoning: 'Neutral tone',
      },
    }),
  }),
});

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

describe('AnalyzeIssueWithAiUseCase (Normalization Branches)', () => {
  it('should normalize structured response with fallback confidences and suggestedResponse array', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
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
    });
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
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
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
    });
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      governanceGateway,
    });

    // Act
    const result = await run(createInput());

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).not.toHaveBeenCalled();
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
  });
});
