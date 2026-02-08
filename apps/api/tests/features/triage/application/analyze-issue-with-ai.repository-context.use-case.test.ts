import type { GovernanceGateway } from '../../../../src/features/triage/application/ports/governance-gateway.port';
import type { IssueHistoryGateway } from '../../../../src/features/triage/application/ports/issue-history-gateway.port';
import type { RepositoryContextGateway } from '../../../../src/features/triage/application/ports/repository-context-gateway.port';
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

const createRepositoryContextGatewayMock = (): jest.Mocked<RepositoryContextGateway> => ({
  findRepositoryContext: jest.fn().mockResolvedValue({
    readme: '# Project setup\nUse pnpm install',
  }),
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
    title: 'Build fails locally',
    body: 'I cannot run this repository in local environment',
    labels: [],
  },
  ...overrides,
});

describe('AnalyzeIssueWithAiUseCase repository context', () => {
  it('should enrich prompt with README context when gateway is available', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const repositoryContextGateway = createRepositoryContextGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      repositoryContextGateway,
      governanceGateway,
    });

    // Act
    await run(createInput());

    // Assert
    expect(repositoryContextGateway.findRepositoryContext).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
    });
    expect(llmGateway.generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        userPrompt: expect.stringContaining('# Project setup\nUse pnpm install'),
      }),
    );
  });

  it('should continue without repository context when gateway fails', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const repositoryContextGateway = createRepositoryContextGatewayMock();
    repositoryContextGateway.findRepositoryContext.mockRejectedValueOnce(new Error('readme failed'));
    const governanceGateway = createGovernanceGatewayMock();
    const logger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      repositoryContextGateway,
      governanceGateway,
      logger,
    });

    // Act
    const result = await run(createInput());

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(logger.info).toHaveBeenCalledWith(
      'AnalyzeIssueWithAiUseCase failed loading repository context. Continuing without it.',
      expect.objectContaining({
        repositoryFullName: 'org/repo',
        issueNumber: 42,
      }),
    );
    expect(llmGateway.generateJson).toHaveBeenCalledWith(
      expect.objectContaining({
        userPrompt: expect.stringContaining('Repository context (README excerpt):\n(none)'),
      }),
    );
  });
});
