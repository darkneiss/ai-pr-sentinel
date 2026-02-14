import type { RequestHandler } from 'express';

import type { AnalyzeIssueWithAiInput, AnalyzeIssueWithAiResult } from '../../features/triage/application/ports/issue-ai-triage-runner.port';
import type { GovernanceGateway } from '../../features/triage/application/ports/governance-gateway.port';
import type { IssueHistoryGateway } from '../../features/triage/application/ports/issue-history-gateway.port';
import type { RepositoryAuthorizationGateway } from '../../features/triage/application/ports/repository-authorization-gateway.port';
import type { RepositoryContextGateway } from '../../features/triage/application/ports/repository-context-gateway.port';
import type { WebhookDeliveryGateway } from '../../features/triage/application/ports/webhook-delivery-gateway.port';
import type { ScmProvider } from './scm-provider-config.service';
import type { Logger } from '../../shared/infrastructure/logging/env-logger';

const GITHUB_WEBHOOK_ROUTE = '/webhooks/github';

export interface ScmWebhookControllerDependencies {
  governanceGateway: GovernanceGateway;
  analyzeIssueWithAi?: (input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>;
  logger: Logger;
  webhookSecret?: string;
  webhookDeliveryGateway: WebhookDeliveryGateway;
  webhookDeliveryTtlSeconds: number;
  requireDeliveryId: boolean;
  repositoryAuthorizationGateway: RepositoryAuthorizationGateway;
}

export interface ScmProviderIntegration {
  webhookRoute: string;
  createWebhookController: (dependencies: ScmWebhookControllerDependencies) => RequestHandler;
  createGovernanceGateway: () => GovernanceGateway;
  createIssueHistoryGateway: () => IssueHistoryGateway;
  loadRepositoryContextGatewayFactory: () => (params?: { logger?: Logger }) => RepositoryContextGateway;
}

const createGithubIntegration = (): ScmProviderIntegration => ({
  webhookRoute: GITHUB_WEBHOOK_ROUTE,
  createWebhookController: (dependencies) => {
    const { createGithubWebhookController } = require('../../features/triage/infrastructure/controllers/github-webhook.controller') as {
      createGithubWebhookController: (dependencies: ScmWebhookControllerDependencies) => RequestHandler;
    };

    return createGithubWebhookController(dependencies);
  },
  createGovernanceGateway: () => {
    const { createGithubGovernanceAdapter } = require('../../features/triage/infrastructure/adapters/github-governance.adapter') as {
      createGithubGovernanceAdapter: () => GovernanceGateway;
    };

    return createGithubGovernanceAdapter();
  },
  createIssueHistoryGateway: () => {
    const { createGithubIssueHistoryAdapter } = require('../../features/triage/infrastructure/adapters/github-issue-history.adapter') as {
      createGithubIssueHistoryAdapter: () => IssueHistoryGateway;
    };

    return createGithubIssueHistoryAdapter();
  },
  loadRepositoryContextGatewayFactory: () => {
    const { createGithubRepositoryContextAdapter } = require('../../features/triage/infrastructure/adapters/github-repository-context.adapter') as {
      createGithubRepositoryContextAdapter: (params?: { logger?: Logger }) => RepositoryContextGateway;
    };

    return createGithubRepositoryContextAdapter;
  },
});

const PROVIDER_INTEGRATION_RESOLVERS: Record<ScmProvider, () => ScmProviderIntegration> = {
  github: createGithubIntegration,
};

export const resolveScmProviderIntegration = (scmProvider: ScmProvider): ScmProviderIntegration =>
  PROVIDER_INTEGRATION_RESOLVERS[scmProvider]();
