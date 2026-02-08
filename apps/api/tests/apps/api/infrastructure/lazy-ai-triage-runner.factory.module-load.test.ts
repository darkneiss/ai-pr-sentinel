import type { GovernanceGateway } from '../../../../src/features/triage/application/ports/governance-gateway.port';

const createGovernanceGatewayMock = (): jest.Mocked<GovernanceGateway> => ({
  addLabels: jest.fn().mockResolvedValue(undefined),
  removeLabel: jest.fn().mockResolvedValue(undefined),
  createComment: jest.fn().mockResolvedValue(undefined),
  logValidatedIssue: jest.fn().mockResolvedValue(undefined),
});

describe('LazyAiTriageRunnerFactory', () => {
  it('should not swallow repository-context module load errors', async () => {
    const { isAiTriageEnabled } = await import('../../../../src/infrastructure/composition/lazy-ai-triage-runner.factory');
    const previousAiTriageEnabled = process.env.AI_TRIAGE_ENABLED;
    expect(
      isAiTriageEnabled({
        get: jest.fn(),
        getBoolean: jest.fn().mockReturnValue(true),
      }),
    ).toBe(true);
    expect(
      isAiTriageEnabled({
        get: jest.fn(),
        getBoolean: jest.fn().mockReturnValue(undefined),
      }),
    ).toBe(false);
    process.env.AI_TRIAGE_ENABLED = 'true';
    expect(isAiTriageEnabled()).toBe(true);
    process.env.AI_TRIAGE_ENABLED = 'false';
    expect(isAiTriageEnabled()).toBe(false);
    process.env.AI_TRIAGE_ENABLED = previousAiTriageEnabled;

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
      const analyzeRunnerMock = jest.fn().mockResolvedValue({ status: 'completed' });
      jest.doMock('../../../../src/features/triage/application/use-cases/analyze-issue-with-ai.use-case', () => ({
        analyzeIssueWithAi: () => analyzeRunnerMock,
      }));
      jest.doMock('../../../../src/features/triage/infrastructure/adapters/github-repository-context.adapter', () => ({
        createGithubRepositoryContextAdapter: () => {
          throw new Error('repository-context adapter init failure');
        },
      }));
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

      // Act
      const result = await run({
        action: 'opened',
        repositoryFullName: 'org/repo',
        issue: {
          number: 1,
          title: 'How to run this project?',
          body: 'I need setup help',
          labels: [],
        },
      });

      // Assert
      expect(result).toEqual({ status: 'completed' });
      expect(logger.info).toHaveBeenCalledWith(
        'App could not initialize repository context gateway. Continuing without repository context.',
        expect.objectContaining({
          error: expect.any(Error),
        }),
      );
    });
  });
});
