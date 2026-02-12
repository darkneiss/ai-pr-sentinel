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

const createInput = (overrides: Partial<AnalyzeIssueWithAiInput> = {}): AnalyzeIssueWithAiInput => ({
  action: 'opened',
  repositoryFullName: 'org/repo',
  issue: {
    number: 88,
    title: 'Esto es una mierda',
    body: 'No tienes ni idea de lo que haces.',
    labels: [],
  },
  ...overrides,
});

describe('AnalyzeIssueWithAiUseCase (Fail-open Guards)', () => {
  it('should keep fail-open skipped when AI provider fails', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest.fn().mockRejectedValue(new Error('provider blocked response')),
    };
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway: jest.Mocked<GovernanceGateway> = {
      addLabels: jest.fn().mockResolvedValue(undefined),
      removeLabel: jest.fn().mockResolvedValue(undefined),
      createComment: jest.fn().mockResolvedValue(undefined),
      logValidatedIssue: jest.fn().mockResolvedValue(undefined),
    };
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
    const result = await run(createInput());

    // Assert
    expect(result).toEqual({ status: 'skipped', reason: 'ai_unavailable' });
    expect(governanceGateway.addLabels).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('should keep fail-open skipped and avoid governance writes when provider fails', async () => {
    // Arrange
    const llmGateway: jest.Mocked<LLMGateway> = {
      generateJson: jest.fn().mockRejectedValue(new Error('provider blocked response')),
    };
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway: jest.Mocked<GovernanceGateway> = {
      addLabels: jest.fn().mockRejectedValue(new Error('github write failed')),
      removeLabel: jest.fn().mockResolvedValue(undefined),
      createComment: jest.fn().mockResolvedValue(undefined),
      logValidatedIssue: jest.fn().mockResolvedValue(undefined),
    };
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
    const result = await run(
      createInput({
        issue: {
          number: 89,
          title: 'Esto es una mierda',
          body: 'No tienes ni idea de lo que haces.',
          labels: [],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'skipped', reason: 'ai_unavailable' });
    expect(governanceGateway.addLabels).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
