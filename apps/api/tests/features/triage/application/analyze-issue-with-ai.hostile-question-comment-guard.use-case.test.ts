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
    title: 'How can I fix this damn bug?',
    body: 'This is broken and the setup is awful. How do I run this?',
    labels: [],
  },
  ...overrides,
});

describe('AnalyzeIssueWithAiUseCase (Hostile Question Comment Guard)', () => {
  it('should not create fallback question comment when tone is hostile', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest.fn().mockResolvedValue({
        rawText: JSON.stringify({
          classification: {
            type: 'bug',
            confidence: 0.8,
            reasoning: 'Bug report.',
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
      issueNumber: 42,
      labels: ['triage/monitor'],
    });
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
  });

  it('should not create ai suggested question comment when tone is hostile', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest.fn().mockResolvedValue({
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
            tone: 'hostile',
            reasoning: 'Hostile tone.',
          },
          suggestedResponse: '- Set env vars\n- Run pnpm --filter api dev',
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
      issueNumber: 42,
      labels: ['kind/question'],
    });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      labels: ['triage/monitor'],
    });
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
  });
});
