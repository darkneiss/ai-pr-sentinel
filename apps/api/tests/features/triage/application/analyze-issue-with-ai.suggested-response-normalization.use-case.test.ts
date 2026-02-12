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
    title: 'How do I set this up?',
    body: 'Need a setup checklist for local development',
    labels: [],
  },
  ...overrides,
});

describe('AnalyzeIssueWithAiUseCase (Suggested Response Normalization)', () => {
  it('should normalize suggested_response array and create question comment', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest.fn().mockResolvedValue({
        rawText: JSON.stringify({
          classification: {
            type: 'question',
            confidence: 0.95,
          },
          duplicateDetection: {
            isDuplicate: false,
            similarityScore: 0.1,
          },
          sentiment: {
            tone: 'neutral',
          },
          suggested_response: ['Step A', 'Step B'],
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
    expect(governanceGateway.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('Step A\nStep B'),
      }),
    );
  });

  it('should ignore suggestedResponse array when it has no non-empty string lines', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest.fn().mockResolvedValue({
        rawText: JSON.stringify({
          classification: {
            type: 'bug',
            confidence: 0.95,
          },
          duplicateDetection: {
            isDuplicate: false,
            similarityScore: 0.1,
          },
          sentiment: {
            tone: 'neutral',
          },
          suggestedResponse: ['   ', 42],
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
          number: 42,
          title: 'Build issue on startup',
          body: 'Application fails during startup sequence.',
          labels: [],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      labels: ['kind/bug'],
    });
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
  });
});
