import type { AnalyzeIssueWithAiInput, AnalyzeIssueWithAiResult } from '../../features/triage/application/use-cases/analyze-issue-with-ai.use-case';
import type { GovernanceGateway } from '../../features/triage/application/ports/governance-gateway.port';
import type { RepositoryContextGateway } from '../../features/triage/application/ports/repository-context-gateway.port';
import type { QuestionResponseMetricsPort } from '../../shared/application/ports/question-response-metrics.port';
import type { Logger } from '../../shared/infrastructure/logging/env-logger';

const AI_TRIAGE_ENABLED_ENV_VAR = 'AI_TRIAGE_ENABLED';
const GITHUB_BOT_LOGIN_ENV_VAR = 'GITHUB_BOT_LOGIN';

export const isAiTriageEnabled = (): boolean =>
  (process.env[AI_TRIAGE_ENABLED_ENV_VAR] ?? '').toLowerCase() === 'true';

export const createLazyAnalyzeIssueWithAi = (
  governanceGateway: GovernanceGateway,
  logger: Logger,
  metrics: QuestionResponseMetricsPort,
): ((input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>) => {
  let runAnalyzeIssueWithAi:
    | ((input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>)
    | undefined;

  const getAnalyzeIssueWithAi = (): ((input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>) => {
    if (!runAnalyzeIssueWithAi) {
      const { createLlmGateway } = require('./llm-gateway.factory') as {
        createLlmGateway: () => import('../../shared/application/ports/llm-gateway.port').LLMGateway;
      };
      const { createGithubIssueHistoryAdapter } = require('../../features/triage/infrastructure/adapters/github-issue-history.adapter') as {
        createGithubIssueHistoryAdapter: () => import('../../features/triage/application/ports/issue-history-gateway.port').IssueHistoryGateway;
      };
      const { analyzeIssueWithAi } = require('../../features/triage/application/use-cases/analyze-issue-with-ai.use-case') as {
        analyzeIssueWithAi: (dependencies: {
          llmGateway: import('../../shared/application/ports/llm-gateway.port').LLMGateway;
          issueHistoryGateway: import('../../features/triage/application/ports/issue-history-gateway.port').IssueHistoryGateway;
          repositoryContextGateway?: RepositoryContextGateway;
          governanceGateway: GovernanceGateway;
          questionResponseMetrics?: QuestionResponseMetricsPort;
          botLogin?: string;
          logger?: Logger;
        }) => (input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>;
      };
      const { createGithubRepositoryContextAdapter } = require('../../features/triage/infrastructure/adapters/github-repository-context.adapter') as {
        createGithubRepositoryContextAdapter: (params?: { logger?: Logger }) => RepositoryContextGateway;
      };
      let repositoryContextGateway: RepositoryContextGateway | undefined;
      try {
        repositoryContextGateway = createGithubRepositoryContextAdapter({ logger });
      } catch (error: unknown) {
        logger.info?.('App could not initialize repository context gateway. Continuing without repository context.', {
          error,
        });
      }

      runAnalyzeIssueWithAi = analyzeIssueWithAi({
        llmGateway: createLlmGateway(),
        issueHistoryGateway: createGithubIssueHistoryAdapter(),
        repositoryContextGateway,
        governanceGateway,
        questionResponseMetrics: metrics,
        botLogin: process.env[GITHUB_BOT_LOGIN_ENV_VAR],
        logger,
      });
    }

    return runAnalyzeIssueWithAi;
  };

  return async (input: AnalyzeIssueWithAiInput): Promise<AnalyzeIssueWithAiResult> =>
    getAnalyzeIssueWithAi()(input);
};
