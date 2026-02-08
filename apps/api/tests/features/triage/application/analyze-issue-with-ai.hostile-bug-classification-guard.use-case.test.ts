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
    number: 34,
    title: 'Esto funciona fatal',
    body: 'Parece que esto funciona como el culo así que espabila.',
    labels: [],
  },
  ...overrides,
});

describe('AnalyzeIssueWithAiUseCase (Hostile Bug Classification Guard)', () => {
  it('should skip kind/bug label when issue has hostile sentiment with high confidence', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest.fn().mockResolvedValue({
        rawText: JSON.stringify({
          classification: {
            type: 'bug',
            confidence: 0.95,
            reasoning: 'The user says it does not work.',
          },
          duplicateDetection: {
            isDuplicate: false,
            originalIssueNumber: null,
            similarityScore: 0.1,
          },
          sentiment: {
            tone: 'hostile',
            confidence: 0.95,
            reasoning: 'Insulting language.',
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
      issueNumber: 34,
      labels: ['kind/bug'],
    });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 34,
      labels: ['triage/monitor'],
    });
  });

  it('should remove existing kind label when issue has hostile sentiment with high confidence', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest.fn().mockResolvedValue({
        rawText: JSON.stringify({
          classification: {
            type: 'bug',
            confidence: 0.95,
            reasoning: 'Hostile content should prevail over classification labels.',
          },
          duplicateDetection: {
            isDuplicate: false,
            originalIssueNumber: null,
            similarityScore: 0.1,
          },
          sentiment: {
            tone: 'hostile',
            confidence: 0.95,
            reasoning: 'Hostile tone.',
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
          number: 35,
          title: 'Esto va fatal y me cabrea',
          body: 'Fails with error 500. Steps to reproduce: open login, submit form, crash.',
          labels: ['kind/bug'],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.removeLabel).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 35,
      label: 'kind/bug',
    });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 35,
      labels: ['triage/monitor'],
    });
  });
});
