import express from 'express';

import type { AnalyzeIssueWithAiInput, AnalyzeIssueWithAiResult } from './features/triage/application/use-cases/analyze-issue-with-ai.use-case';
import type { GovernanceGateway } from './features/triage/application/ports/governance-gateway.port';
import { createGithubWebhookController } from './features/triage/infrastructure/controllers/github-webhook.controller';
import type { QuestionResponseMetricsPort } from './shared/application/ports/question-response-metrics.port';
import { createEnvLogger, type Logger } from './shared/infrastructure/logging/env-logger';
import { createInMemoryQuestionResponseMetrics } from './shared/infrastructure/metrics/in-memory-question-response.metrics';

const HEALTH_ROUTE = '/health';
const GITHUB_WEBHOOK_ROUTE = '/webhooks/github';
const DEFAULT_APP_VERSION = '1.0.0';
const APP_VERSION_ENV_VAR = 'APP_VERSION';
const NPM_PACKAGE_VERSION_ENV_VAR = 'npm_package_version';
const AI_TRIAGE_ENABLED_ENV_VAR = 'AI_TRIAGE_ENABLED';
const GITHUB_BOT_LOGIN_ENV_VAR = 'GITHUB_BOT_LOGIN';
const questionResponseMetrics = createInMemoryQuestionResponseMetrics();

interface CreateAppParams {
  governanceGateway?: GovernanceGateway;
  analyzeIssueWithAi?: (input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>;
  logger?: Logger;
}

const createLazyGovernanceGateway = (): GovernanceGateway => {
  let gateway: GovernanceGateway | undefined;

  const getGateway = (): GovernanceGateway => {
    if (!gateway) {
      // Lazy-load adapter to keep app composition testable without loading Octokit at module import time.
      const { createGithubGovernanceAdapter } = require('./features/triage/infrastructure/adapters/github-governance.adapter') as {
        createGithubGovernanceAdapter: () => GovernanceGateway;
      };
      gateway = createGithubGovernanceAdapter();
    }
    return gateway;
  };

  return {
    addLabels: async (input) => getGateway().addLabels(input),
    removeLabel: async (input) => getGateway().removeLabel(input),
    createComment: async (input) => getGateway().createComment(input),
    logValidatedIssue: async (input) => getGateway().logValidatedIssue(input),
  };
};

const isAiTriageEnabled = (): boolean =>
  (process.env[AI_TRIAGE_ENABLED_ENV_VAR] ?? '').toLowerCase() === 'true';

const createLazyAnalyzeIssueWithAi = (
  governanceGateway: GovernanceGateway,
  logger: Logger,
  metrics: QuestionResponseMetricsPort,
): ((input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>) => {
  let runAnalyzeIssueWithAi:
    | ((input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>)
    | undefined;

  const getAnalyzeIssueWithAi = (): ((input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>) => {
    if (!runAnalyzeIssueWithAi) {
      const { createLlmGateway } = require('./shared/infrastructure/ai/llm-gateway.factory') as {
        createLlmGateway: () => import('./shared/application/ports/llm-gateway.port').LLMGateway;
      };
      const { createGithubIssueHistoryAdapter } = require('./features/triage/infrastructure/adapters/github-issue-history.adapter') as {
        createGithubIssueHistoryAdapter: () => import('./features/triage/application/ports/issue-history-gateway.port').IssueHistoryGateway;
      };
      const { analyzeIssueWithAi } = require('./features/triage/application/use-cases/analyze-issue-with-ai.use-case') as {
        analyzeIssueWithAi: (dependencies: {
          llmGateway: import('./shared/application/ports/llm-gateway.port').LLMGateway;
          issueHistoryGateway: import('./features/triage/application/ports/issue-history-gateway.port').IssueHistoryGateway;
          governanceGateway: GovernanceGateway;
          questionResponseMetrics?: QuestionResponseMetricsPort;
          botLogin?: string;
          logger?: Logger;
        }) => (input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>;
      };

      runAnalyzeIssueWithAi = analyzeIssueWithAi({
        llmGateway: createLlmGateway(),
        issueHistoryGateway: createGithubIssueHistoryAdapter(),
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

export const createApp = (params: CreateAppParams = {}) => {
  const app = express();
  const logger = params.logger ?? createEnvLogger();
  const governanceGateway = params.governanceGateway ?? createLazyGovernanceGateway();
  const analyzeIssueWithAi =
    params.analyzeIssueWithAi ??
    (isAiTriageEnabled()
      ? createLazyAnalyzeIssueWithAi(governanceGateway, logger, questionResponseMetrics)
      : undefined);
  const appVersion =
    process.env[APP_VERSION_ENV_VAR] ??
    process.env[NPM_PACKAGE_VERSION_ENV_VAR] ??
    DEFAULT_APP_VERSION;

  app.use(express.json());

  app.get(HEALTH_ROUTE, (_req, res) => {
    res.status(200).json({
      status: 'ok',
      version: appVersion,
    });
  });

  app.post(
    GITHUB_WEBHOOK_ROUTE,
    createGithubWebhookController({
      governanceGateway,
      analyzeIssueWithAi,
      logger,
    }),
  );

  return app;
};
