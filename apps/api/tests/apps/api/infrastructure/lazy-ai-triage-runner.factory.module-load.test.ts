import type { GovernanceGateway } from '../../../../src/features/triage/application/ports/governance-gateway.port';

const createGovernanceGatewayMock = (): jest.Mocked<GovernanceGateway> => ({
  addLabels: jest.fn().mockResolvedValue(undefined),
  removeLabel: jest.fn().mockResolvedValue(undefined),
  createComment: jest.fn().mockResolvedValue(undefined),
  logValidatedIssue: jest.fn().mockResolvedValue(undefined),
});

describe('LazyAiTriageRunnerFactory', () => {
  it('should not swallow repository-context module load errors', async () => {
    await jest.isolateModulesAsync(async () => {
      // Arrange
      jest.doMock('../../../../src/infrastructure/composition/llm-gateway.factory', () => ({
        createLlmGateway: () => ({
          generateJson: jest.fn(),
        }),
      }));
      jest.doMock('../../../../src/features/triage/infrastructure/adapters/github-issue-history.adapter', () => ({
        createGithubIssueHistoryAdapter: () => ({
          findRecentIssues: jest.fn().mockResolvedValue([]),
          hasIssueCommentWithPrefix: jest.fn().mockResolvedValue(false),
        }),
      }));
      jest.doMock('../../../../src/features/triage/application/use-cases/analyze-issue-with-ai.use-case', () => ({
        analyzeIssueWithAi: () =>
          jest.fn().mockResolvedValue({
            status: 'completed',
          }),
      }));
      jest.doMock('../../../../src/features/triage/infrastructure/adapters/github-repository-context.adapter', () => {
        throw new Error('repository-context module load failure');
      });
      const { createLazyAnalyzeIssueWithAi } = await import(
        '../../../../src/infrastructure/composition/lazy-ai-triage-runner.factory'
      );
      const governanceGateway = createGovernanceGatewayMock();
      const logger = {
        debug: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
      };
      const metrics = {
        increment: jest.fn(),
        recordQuestionResponseSource: jest.fn(),
        snapshot: jest.fn().mockReturnValue({
          aiSuggestedResponse: 0,
          fallbackChecklist: 0,
          total: 0,
        }),
      };
      const run = createLazyAnalyzeIssueWithAi(governanceGateway, logger, metrics);

      // Act + Assert
      await expect(
        run({
          action: 'opened',
          repositoryFullName: 'org/repo',
          issue: {
            number: 1,
            title: 'How to run this project?',
            body: 'I need setup help',
            labels: [],
          },
        }),
      ).rejects.toThrow('repository-context module load failure');
    });
  });
});
