import type {
  AnalyzeIssueWithAiInput,
  AnalyzeIssueWithAiResult,
} from './features/triage/application/use-cases/analyze-issue-with-ai.use-case';
import type { GovernanceGateway } from './features/triage/application/ports/governance-gateway.port';
import { createTriageWebhookComposition } from './infrastructure/composition/triage-webhook-composition.factory';
import { createHttpApp } from './infrastructure/http/http-app.factory';
import { createEnvConfig } from './shared/infrastructure/config/env-config.adapter';
import { createEnvLogger, type Logger } from './shared/infrastructure/logging/env-logger';
import { createInMemoryQuestionResponseMetrics } from './shared/infrastructure/metrics/in-memory-question-response.metrics';

const DEFAULT_APP_VERSION = '1.0.0';
const APP_VERSION_ENV_VAR = 'APP_VERSION';
const NPM_PACKAGE_VERSION_ENV_VAR = 'npm_package_version';

interface CreateAppParams {
  governanceGateway?: GovernanceGateway;
  analyzeIssueWithAi?: (input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>;
  logger?: Logger;
}

export const createApp = (params: CreateAppParams = {}) => {
  const logger = params.logger ?? createEnvLogger();
  const config = createEnvConfig();
  const questionResponseMetrics = createInMemoryQuestionResponseMetrics();
  const appVersion =
    config.get(APP_VERSION_ENV_VAR) ??
    config.get(NPM_PACKAGE_VERSION_ENV_VAR) ??
    DEFAULT_APP_VERSION;
  const triageWebhookComposition = createTriageWebhookComposition({
    logger,
    config,
    questionResponseMetrics,
    governanceGateway: params.governanceGateway,
    analyzeIssueWithAi: params.analyzeIssueWithAi,
  });

  return createHttpApp({
    appVersion,
    governanceGateway: triageWebhookComposition.governanceGateway,
    analyzeIssueWithAi: triageWebhookComposition.analyzeIssueWithAi,
    logger,
    webhookSecret: triageWebhookComposition.webhookSecret,
  });
};
