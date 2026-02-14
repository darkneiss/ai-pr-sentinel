import type {
  AnalyzeIssueWithAiInput,
  AnalyzeIssueWithAiResult,
} from './features/triage/application/ports/issue-ai-triage-runner.port';
import type { GovernanceGateway } from './features/triage/application/ports/governance-gateway.port';
import { resolveApiVersion } from './infrastructure/composition/api-version-config.service';
import { createTriageWebhookComposition } from './infrastructure/composition/triage-webhook-composition.factory';
import { createHttpApp } from './infrastructure/http/http-app.factory';
import { createEnvConfig } from './shared/infrastructure/config/env-config.adapter';
import { createEnvLogger, type Logger } from './shared/infrastructure/logging/env-logger';
import { createInMemoryQuestionResponseMetrics } from './shared/infrastructure/metrics/in-memory-question-response.metrics';

interface CreateAppParams {
  governanceGateway?: GovernanceGateway;
  analyzeIssueWithAi?: (input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>;
  logger?: Logger;
}

export const createApp = (params: CreateAppParams = {}) => {
  const logger = params.logger ?? createEnvLogger();
  const config = createEnvConfig();
  const questionResponseMetrics = createInMemoryQuestionResponseMetrics();
  const appVersion = resolveApiVersion(config);
  const triageWebhookComposition = createTriageWebhookComposition({
    logger,
    config,
    questionResponseMetrics,
    governanceGateway: params.governanceGateway,
    analyzeIssueWithAi: params.analyzeIssueWithAi,
  });

  return createHttpApp({
    appVersion,
    scmProvider: triageWebhookComposition.scmProvider,
    governanceGateway: triageWebhookComposition.governanceGateway,
    analyzeIssueWithAi: triageWebhookComposition.analyzeIssueWithAi,
    logger,
    webhookSecret: triageWebhookComposition.webhookSecret,
    webhookDeliveryGateway: triageWebhookComposition.webhookDeliveryGateway,
    webhookDeliveryTtlSeconds: triageWebhookComposition.webhookDeliveryTtlSeconds,
    requireDeliveryId: triageWebhookComposition.requireDeliveryId,
    repositoryAuthorizationGateway: triageWebhookComposition.repositoryAuthorizationGateway,
  });
};
