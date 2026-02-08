import express from 'express';

import type {
  AnalyzeIssueWithAiInput,
  AnalyzeIssueWithAiResult,
} from './features/triage/application/use-cases/analyze-issue-with-ai.use-case';
import type { GovernanceGateway } from './features/triage/application/ports/governance-gateway.port';
import { createGithubWebhookController } from './features/triage/infrastructure/controllers/github-webhook.controller';
import { createLazyAnalyzeIssueWithAi, isAiTriageEnabled } from './infrastructure/composition/lazy-ai-triage-runner.factory';
import { createLazyGovernanceGateway } from './infrastructure/composition/lazy-governance-gateway.factory';
import { resolveWebhookSignatureConfig } from './infrastructure/composition/webhook-signature-config.service';
import { createEnvLogger, type Logger } from './shared/infrastructure/logging/env-logger';
import { createInMemoryQuestionResponseMetrics } from './shared/infrastructure/metrics/in-memory-question-response.metrics';

const HEALTH_ROUTE = '/health';
const GITHUB_WEBHOOK_ROUTE = '/webhooks/github';
const DEFAULT_APP_VERSION = '1.0.0';
const APP_VERSION_ENV_VAR = 'APP_VERSION';
const NPM_PACKAGE_VERSION_ENV_VAR = 'npm_package_version';

interface CreateAppParams {
  governanceGateway?: GovernanceGateway;
  analyzeIssueWithAi?: (input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>;
  logger?: Logger;
}

export const createApp = (params: CreateAppParams = {}) => {
  const app = express();
  const logger = params.logger ?? createEnvLogger();
  const questionResponseMetrics = createInMemoryQuestionResponseMetrics();
  const signatureConfig = resolveWebhookSignatureConfig();
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

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        const requestWithRawBody = req as typeof req & { rawBody?: Buffer };
        requestWithRawBody.rawBody = Buffer.from(buf);
      },
    }),
  );

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
      webhookSecret: signatureConfig.verifyWebhookSignature ? signatureConfig.webhookSecret : undefined,
    }),
  );

  return app;
};
