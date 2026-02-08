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
    title: 'How can I configure env vars?',
    body: 'Need setup checklist for local execution',
    labels: [],
  },
  ...overrides,
});

describe('AnalyzeIssueWithAiUseCase (Normalization Branches 2)', () => {
  it('should normalize non-empty suggestedResponse string and fallback unknown tone to neutral', async () => {
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
          isDuplicate: false,
          similarityScore: 'unknown',
        },
        sentiment: {
          tone: 'angry',
        },
        suggestedResponse: 'Use pnpm install first',
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
  });

  it('should normalize suggestedResponse array and create question response comment', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    llmGateway.generateJson.mockResolvedValueOnce({
      rawText: JSON.stringify({
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
    expect(governanceGateway.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('Step 1: install dependencies\nStep 2: configure .env'),
      }),
    );
  });
});
