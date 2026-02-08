import type { GovernanceGateway } from '../../../../src/features/triage/application/ports/governance-gateway.port';
import type { IssueHistoryGateway } from '../../../../src/features/triage/application/ports/issue-history-gateway.port';
import type { RepositoryContextGateway } from '../../../../src/features/triage/application/ports/repository-context-gateway.port';
import {
  analyzeIssueWithAi,
  type AnalyzeIssueWithAiInput,
} from '../../../../src/features/triage/application/use-cases/analyze-issue-with-ai.use-case';
import type { LLMGateway } from '../../../../src/shared/application/ports/llm-gateway.port';

const createLlmGatewayMock = (suggestedResponse: string): jest.Mocked<LLMGateway> => ({
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
      suggestedResponse,
    }),
  }),
});

const createIssueHistoryGatewayMock = (): jest.Mocked<IssueHistoryGateway> => ({
  findRecentIssues: jest.fn().mockResolvedValue([]),
  hasIssueCommentWithPrefix: jest.fn().mockResolvedValue(false),
});

const createRepositoryContextGatewayMock = (readme: string): jest.Mocked<RepositoryContextGateway> => ({
  findRepositoryContext: jest.fn().mockResolvedValue({ readme }),
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
    number: 61,
    title: 'How can I contribute?',
    body: 'I want to understand this repository setup and contribution flow.',
    labels: [],
  },
  ...overrides,
});

describe('AnalyzeIssueWithAiUseCase (Repository Context Usage Log)', () => {
  it('should log usedRepositoryContext=true when AI answer overlaps repository context', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock(
      '- Review governance architecture decisions.\n- Follow hexagonal contribution workflow.\n- Use triage labels as documented.',
    );
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const repositoryContextGateway = createRepositoryContextGatewayMock(
      '# Project\nThis repository uses hexagonal architecture and governance workflows.',
    );
    const governanceGateway = createGovernanceGatewayMock();
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
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
      'AnalyzeIssueWithAiUseCase question response source selected.',
      expect.objectContaining({
        repositoryFullName: 'org/repo',
        issueNumber: 61,
        usedRepositoryContext: true,
      }),
    );
  });

  it('should log usedRepositoryContext=false when no repository context is available', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock(
      '- Share your current .env values.\n- Share exact commands and errors.\n- Describe expected vs actual behavior.',
    );
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
    };
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      governanceGateway,
      logger,
    });

    // Act
    const result = await run(createInput({ issue: { ...createInput().issue, number: 62 } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(logger.info).toHaveBeenCalledWith(
      'AnalyzeIssueWithAiUseCase question response source selected.',
      expect.objectContaining({
        repositoryFullName: 'org/repo',
        issueNumber: 62,
        usedRepositoryContext: false,
      }),
    );
  });

  it('should log usedRepositoryContext=false when repository context has no meaningful tokens', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock(
      '- Share architecture details.\\n- Explain governance rules.\\n- Include exact setup steps.',
    );
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const repositoryContextGateway = createRepositoryContextGatewayMock(
      'this and the issue setup with repo and your',
    );
    const governanceGateway = createGovernanceGatewayMock();
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
    };
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      repositoryContextGateway,
      governanceGateway,
      logger,
    });

    // Act
    const result = await run(createInput({ issue: { ...createInput().issue, number: 63 } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(logger.info).toHaveBeenCalledWith(
      'AnalyzeIssueWithAiUseCase question response source selected.',
      expect.objectContaining({
        repositoryFullName: 'org/repo',
        issueNumber: 63,
        usedRepositoryContext: false,
      }),
    );
  });

  it('should log usedRepositoryContext=false when response does not overlap with repository context', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock(
      '- Configure database connection settings.\\n- Validate API authentication tokens.\\n- Execute migration checks.',
    );
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const repositoryContextGateway = createRepositoryContextGatewayMock(
      '# Project\\nThis repository focuses on governance policies and triage workflows.',
    );
    const governanceGateway = createGovernanceGatewayMock();
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
    };
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      repositoryContextGateway,
      governanceGateway,
      logger,
    });

    // Act
    const result = await run(createInput({ issue: { ...createInput().issue, number: 64 } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(logger.info).toHaveBeenCalledWith(
      'AnalyzeIssueWithAiUseCase question response source selected.',
      expect.objectContaining({
        repositoryFullName: 'org/repo',
        issueNumber: 64,
        usedRepositoryContext: false,
      }),
    );
  });
});
