import express from 'express';

import type { GovernanceGateway } from './features/triage/application/ports/governance-gateway.port';
import { createGithubWebhookController } from './features/triage/infrastructure/controllers/github-webhook.controller';

const HEALTH_ROUTE = '/health';
const GITHUB_WEBHOOK_ROUTE = '/webhooks/github';
const DEFAULT_APP_VERSION = '1.0.0';
const APP_VERSION_ENV_VAR = 'APP_VERSION';
const NPM_PACKAGE_VERSION_ENV_VAR = 'npm_package_version';

interface CreateAppParams {
  governanceGateway?: GovernanceGateway;
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

export const createApp = (params: CreateAppParams = {}) => {
  const app = express();
  const governanceGateway = params.governanceGateway ?? createLazyGovernanceGateway();
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
    }),
  );

  return app;
};
