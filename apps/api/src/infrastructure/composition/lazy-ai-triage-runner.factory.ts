import type {
  AnalyzeIssueWithAiInput,
  AnalyzeIssueWithAiResult,
} from '../../features/triage/application/ports/issue-ai-triage-runner.port';
import type { GovernanceGateway } from '../../features/triage/application/ports/governance-gateway.port';
import type { RepositoryContextGateway } from '../../features/triage/application/ports/repository-context-gateway.port';
import type { ConfigPort } from '../../shared/application/ports/config.port';
import type { QuestionResponseMetricsPort } from '../../shared/application/ports/question-response-metrics.port';
import { createEnvConfig } from '../../shared/infrastructure/config/env-config.adapter';
import type { Logger } from '../../shared/infrastructure/logging/env-logger';
import { resolveScmProvider, type ScmProvider } from './scm-provider-config.service';
import { resolveScmProviderIntegration } from './scm-provider-integration.registry';

const AI_TRIAGE_ENABLED_ENV_VAR = 'AI_TRIAGE_ENABLED';
const SCM_BOT_LOGIN_ENV_VAR = 'SCM_BOT_LOGIN';

export const isAiTriageEnabled = (config: ConfigPort = createEnvConfig()): boolean =>
  config.getBoolean(AI_TRIAGE_ENABLED_ENV_VAR) === true;

interface CreateLazyAnalyzeIssueWithAiOptions {
  scmProvider?: ScmProvider;
}

export const createLazyAnalyzeIssueWithAi = (
  governanceGateway: GovernanceGateway,
  logger: Logger,
  metrics: QuestionResponseMetricsPort,
  config: ConfigPort = createEnvConfig(),
  options: CreateLazyAnalyzeIssueWithAiOptions = {},
): ((input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>) => {
  const scmProvider = options.scmProvider ?? resolveScmProvider(config);
  let runAnalyzeIssueWithAi:
    | ((input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>)
    | undefined;

  const getAnalyzeIssueWithAi = (): ((input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>) => {
    if (!runAnalyzeIssueWithAi) {
      const { createLlmGateway } = require('./llm-gateway.factory') as {
        createLlmGateway: () => import('../../shared/application/ports/llm-gateway.port').LLMGateway;
      };
      const { analyzeIssueWithAi } = require('../../features/triage/application/use-cases/analyze-issue-with-ai.use-case') as {
        analyzeIssueWithAi: (dependencies: {
          llmGateway: import('../../shared/application/ports/llm-gateway.port').LLMGateway;
          issueHistoryGateway: import('../../features/triage/application/ports/issue-history-gateway.port').IssueHistoryGateway;
          repositoryContextGateway?: RepositoryContextGateway;
          issueTriagePromptGateway?: import('../../shared/application/ports/issue-triage-prompt-gateway.port').IssueTriagePromptGateway;
          governanceGateway: GovernanceGateway;
          questionResponseMetrics?: QuestionResponseMetricsPort;
          botLogin?: string;
          config?: ConfigPort;
          logger?: Logger;
        }) => (input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>;
      };
      const { createIssueTriagePromptRegistry } = require('../../shared/infrastructure/prompts/issue-triage-prompt-registry.adapter') as {
        createIssueTriagePromptRegistry: (params?: { config?: ConfigPort }) => import('../../shared/application/ports/issue-triage-prompt-gateway.port').IssueTriagePromptGateway;
      };
      const scmProviderIntegration = resolveScmProviderIntegration(scmProvider);
      const createRepositoryContextGateway = scmProviderIntegration.loadRepositoryContextGatewayFactory();
      let repositoryContextGateway: RepositoryContextGateway | undefined;
      try {
        repositoryContextGateway = createRepositoryContextGateway({ logger });
      } catch (error: unknown) {
        logger.info?.('App could not initialize repository context gateway. Continuing without repository context.', {
          error,
        });
      }

      runAnalyzeIssueWithAi = analyzeIssueWithAi({
        llmGateway: createLlmGateway(),
        issueHistoryGateway: scmProviderIntegration.createIssueHistoryGateway(),
        repositoryContextGateway,
        issueTriagePromptGateway: createIssueTriagePromptRegistry({ config }),
        governanceGateway,
        questionResponseMetrics: metrics,
        botLogin: config.get(SCM_BOT_LOGIN_ENV_VAR),
        config,
        logger,
      });
    }

    return runAnalyzeIssueWithAi;
  };

  return async (input: AnalyzeIssueWithAiInput): Promise<AnalyzeIssueWithAiResult> =>
    getAnalyzeIssueWithAi()(input);
};
