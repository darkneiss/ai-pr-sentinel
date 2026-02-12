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
    number: 14,
    title: 'How should I configure .env for local setup?',
    body: 'I need a clear setup checklist to run this project locally.',
    labels: [],
  },
  ...overrides,
});

describe('AnalyzeIssueWithAiUseCase (Duplicate Normalization Variants)', () => {
  it('should normalize top-level duplicate/similarity fields and continue actions', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest.fn().mockResolvedValue({
        rawText: JSON.stringify({
          classification: { type: 'question' },
          sentiment: { tone: 'hostile' },
          duplicate: true,
          confidence: 0.85,
          similarityScore: 0.9,
          suggestedResponse: [
            'Please provide more context.',
            'Describe exact steps to reproduce.',
          ],
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
          number: 27,
          title: 'Need help with setup',
          body: 'Can someone explain setup? This is a mess.',
          labels: [],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 27,
      labels: ['kind/question'],
    });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 27,
      labels: ['triage/monitor'],
    });
    expect(governanceGateway.addLabels).not.toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 27,
      labels: ['triage/duplicate'],
    });
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
  });

  it('should normalize isDuplicate root flag and continue governance flow', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest.fn().mockResolvedValue({
        rawText: JSON.stringify({
          classification: { type: 'bug', confidence: 0.9 },
          sentiment: { tone: 'neutral', confidence: 0.8 },
          isDuplicate: true,
          similarityScore: 0.95,
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
          number: 77,
          title: 'Unexpected crash in production',
          body: 'App crashes after deploy.',
          labels: [],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 77,
      labels: ['kind/bug'],
    });
    expect(governanceGateway.addLabels).not.toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 77,
      labels: ['triage/duplicate'],
    });
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
  });

  it('should accept duplicate object alias and continue processing AI actions', async () => {
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
          duplicate: {
            isDuplicate: false,
            similarityScore: 0.1,
          },
          suggestedResponse: [
            'Install dependencies with pnpm.',
            'Set your .env values.',
            'Run the API in development mode.',
          ],
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
      issueNumber: 14,
      labels: ['kind/question'],
    });
    expect(governanceGateway.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryFullName: 'org/repo',
        issueNumber: 14,
        body: expect.stringContaining('AI Triage: Suggested guidance'),
      }),
    );
  });
});
