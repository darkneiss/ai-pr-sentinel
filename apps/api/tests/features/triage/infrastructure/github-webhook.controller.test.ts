import express from 'express';
import request from 'supertest';

import { createGithubWebhookController } from '../../../../src/features/triage/infrastructure/controllers/github-webhook.controller';
import type { GovernanceGateway } from '../../../../src/features/triage/application/ports/governance-gateway.port';

const WEBHOOK_ROUTE = '/webhooks/github';
const REPO_FULL_NAME = 'org/repo';

const createPayload = (overrides: Record<string, unknown> = {}) => ({
  action: 'opened',
  issue: {
    number: 12,
    title: 'Bug in login flow',
    body: 'The app crashes when the user logs in from Safari in private mode.',
    user: {
      login: 'dev_user',
    },
    labels: [],
  },
  repository: {
    full_name: REPO_FULL_NAME,
  },
  ...overrides,
});

const setup = () => {
  const governanceGateway: jest.Mocked<GovernanceGateway> = {
    addLabels: jest.fn().mockResolvedValue(undefined),
    removeLabel: jest.fn().mockResolvedValue(undefined),
    createComment: jest.fn().mockResolvedValue(undefined),
    logValidatedIssue: jest.fn().mockResolvedValue(undefined),
  };

  const app = express();
  app.use(express.json());
  app.post(WEBHOOK_ROUTE, createGithubWebhookController({ governanceGateway }));

  return { app, governanceGateway };
};

describe('GithubWebhookController integration', () => {
  it('should label and comment when receiving an invalid issue on issues.opened', async () => {
    const { app, governanceGateway } = setup();

    const invalidPayload = createPayload({
      action: 'opened',
      issue: {
        number: 12,
        title: 'bug',
        body: 'It crashes.',
        user: {
          login: 'dev_user',
        },
        labels: [],
      },
    });

    const response = await request(app).post(WEBHOOK_ROUTE).send(invalidPayload);

    expect(response.status).toBe(200);
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: REPO_FULL_NAME,
      issueNumber: 12,
      labels: ['triage/needs-info'],
    });
    expect(governanceGateway.createComment).toHaveBeenCalledTimes(1);
    expect(governanceGateway.logValidatedIssue).not.toHaveBeenCalled();
  });

  it('should remove invalid label and log success for a valid issue on issues.edited', async () => {
    const { app, governanceGateway } = setup();

    const validPayload = createPayload({
      action: 'edited',
      issue: {
        number: 12,
        title: 'Bug in login flow when network drops',
        body: 'Steps to reproduce: open app, disable network, submit login form, and check observed crash logs.',
        user: {
          login: 'dev_user',
        },
        labels: [{ name: 'invalid' }],
      },
    });

    const response = await request(app).post(WEBHOOK_ROUTE).send(validPayload);

    expect(response.status).toBe(200);
    expect(governanceGateway.removeLabel).toHaveBeenCalledWith({
      repositoryFullName: REPO_FULL_NAME,
      issueNumber: 12,
      label: 'invalid',
    });
    expect(governanceGateway.logValidatedIssue).toHaveBeenCalledWith({
      repositoryFullName: REPO_FULL_NAME,
      issueNumber: 12,
    });
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
  });

  it('should ignore non-supported issue actions', async () => {
    const { app, governanceGateway } = setup();

    const response = await request(app)
      .post(WEBHOOK_ROUTE)
      .send(createPayload({ action: 'deleted' }));

    expect(response.status).toBe(204);
    expect(governanceGateway.addLabels).not.toHaveBeenCalled();
    expect(governanceGateway.removeLabel).not.toHaveBeenCalled();
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
    expect(governanceGateway.logValidatedIssue).not.toHaveBeenCalled();
  });
});
