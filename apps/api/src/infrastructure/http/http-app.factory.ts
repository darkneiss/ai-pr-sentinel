import express, { type Express } from 'express';

import type {
  AnalyzeIssueWithAiInput,
  AnalyzeIssueWithAiResult,
} from '../../features/triage/application/ports/issue-ai-triage-runner.port';
import type { GovernanceGateway } from '../../features/triage/application/ports/governance-gateway.port';
import type { RepositoryAuthorizationGateway } from '../../features/triage/application/ports/repository-authorization-gateway.port';
import type { WebhookDeliveryGateway } from '../../features/triage/application/ports/webhook-delivery-gateway.port';
import type { ScmProvider } from '../composition/scm-provider-config.service';
import { resolveScmProviderIntegration } from '../composition/scm-provider-integration.registry';
import type { Logger } from '../../shared/infrastructure/logging/env-logger';

const HEALTH_ROUTE = '/health';

interface CreateHttpAppParams {
  appVersion: string;
  scmProvider: ScmProvider;
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
  scmProvider,
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
  const scmProviderIntegration = resolveScmProviderIntegration(scmProvider);

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
    scmProviderIntegration.webhookRoute,
    scmProviderIntegration.createWebhookController({
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
