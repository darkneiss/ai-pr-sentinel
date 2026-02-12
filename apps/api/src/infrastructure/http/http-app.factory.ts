import express, { type Express } from 'express';

import type {
  AnalyzeIssueWithAiInput,
  AnalyzeIssueWithAiResult,
} from '../../features/triage/application/ports/issue-ai-triage-runner.port';
import type { GovernanceGateway } from '../../features/triage/application/ports/governance-gateway.port';
import type { RepositoryAuthorizationGateway } from '../../features/triage/application/ports/repository-authorization-gateway.port';
import type { WebhookDeliveryGateway } from '../../features/triage/application/ports/webhook-delivery-gateway.port';
import { createGithubWebhookController } from '../../features/triage/infrastructure/controllers/github-webhook.controller';
import type { Logger } from '../../shared/infrastructure/logging/env-logger';

const HEALTH_ROUTE = '/health';
const GITHUB_WEBHOOK_ROUTE = '/webhooks/github';

interface CreateHttpAppParams {
  appVersion: string;
  governanceGateway: GovernanceGateway;
  analyzeIssueWithAi?: (input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>;
  logger: Logger;
  webhookSecret?: string;
  webhookDeliveryGateway: WebhookDeliveryGateway;
  webhookDeliveryTtlSeconds: number;
  requireDeliveryId: boolean;
  repositoryAuthorizationGateway: RepositoryAuthorizationGateway;
}

export const createHttpApp = ({
  appVersion,
  governanceGateway,
  analyzeIssueWithAi,
  logger,
  webhookSecret,
  webhookDeliveryGateway,
  webhookDeliveryTtlSeconds,
  requireDeliveryId,
  repositoryAuthorizationGateway,
}: CreateHttpAppParams): Express => {
  const app = express();

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
      webhookSecret,
      webhookDeliveryGateway,
      webhookDeliveryTtlSeconds,
      requireDeliveryId,
      repositoryAuthorizationGateway,
    }),
  );

  return app;
};
