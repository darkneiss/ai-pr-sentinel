import express from 'express';
import request from 'supertest';

import type { AnalyzeIssueWithAiInput, AnalyzeIssueWithAiResult } from '../../../../src/features/triage/application/use-cases/analyze-issue-with-ai.use-case';
import { createGithubWebhookController } from '../../../../src/features/triage/infrastructure/controllers/github-webhook.controller';
import type { GovernanceGateway } from '../../../../src/features/triage/application/ports/governance-gateway.port';
import type { RepositoryAuthorizationGateway } from '../../../../src/features/triage/application/ports/repository-authorization-gateway.port';
import {
  WEBHOOK_DELIVERY_SOURCE_GITHUB,
  type WebhookDeliveryGateway,
} from '../../../../src/features/triage/application/ports/webhook-delivery-gateway.port';
import { createInMemoryWebhookDeliveryAdapter } from '../../../../src/features/triage/infrastructure/adapters/in-memory-webhook-delivery.adapter';

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

const createRepositoryAuthorizationGatewayMock = (): jest.Mocked<RepositoryAuthorizationGateway> => ({
  isAllowed: jest.fn().mockReturnValue(true),
});

const createWebhookDeliveryGatewayMock = (): jest.Mocked<WebhookDeliveryGateway> => ({
  registerIfFirstSeen: jest.fn().mockResolvedValue({ status: 'accepted' }),
  unregister: jest.fn().mockResolvedValue(undefined),
});

const createAiAnalyzerMock = (): jest.MockedFunction<
  (input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>
> => jest.fn().mockResolvedValue({ status: 'completed' });

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

  it('should return 400 when payload is not a valid GitHub issue webhook', async () => {
    const { app, governanceGateway } = setup();
    const response = await request(app).post(WEBHOOK_ROUTE).send({ garbage: true, nope: 123 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid GitHub issue webhook payload' });
    expect(governanceGateway.addLabels).not.toHaveBeenCalled();
    expect(governanceGateway.removeLabel).not.toHaveBeenCalled();
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
    expect(governanceGateway.logValidatedIssue).not.toHaveBeenCalled();
  });

  it('should accept null issue body from GitHub payloads', async () => {
    // Arrange
    const { app, governanceGateway } = setup();
    const payloadWithNullBody = createPayload({
      issue: {
        number: 12,
        title: 'Bug in login flow',
        body: null,
        user: {
          login: 'dev_user',
        },
        labels: [],
      },
    });

    // Act
    const response = await request(app).post(WEBHOOK_ROUTE).send(payloadWithNullBody);

    // Assert
    expect(response.status).toBe(200);
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: REPO_FULL_NAME,
      issueNumber: 12,
      labels: ['triage/needs-info'],
    });
    expect(governanceGateway.createComment).toHaveBeenCalledTimes(1);
  });

  it('should return 400 when request body is missing', async () => {
    const governanceGateway: jest.Mocked<GovernanceGateway> = {
      addLabels: jest.fn().mockResolvedValue(undefined),
      removeLabel: jest.fn().mockResolvedValue(undefined),
      createComment: jest.fn().mockResolvedValue(undefined),
      logValidatedIssue: jest.fn().mockResolvedValue(undefined),
    };
    const app = express();
    app.post(
      WEBHOOK_ROUTE,
      (req, _res, next) => {
        (req as unknown as { body: unknown }).body = undefined;
        next();
      },
      createGithubWebhookController({ governanceGateway }),
    );

    const response = await request(app).post(WEBHOOK_ROUTE).send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid GitHub issue webhook payload' });
  });

  it('should return 500 when an unexpected error happens while processing the webhook', async () => {
    const { app, governanceGateway } = setup();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    governanceGateway.logValidatedIssue.mockRejectedValueOnce(new Error('unexpected failure'));

    const response = await request(app).post(WEBHOOK_ROUTE).send(createPayload());

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal Server Error' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'GithubWebhookController failed processing issue webhook',
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });

  it('should remove triage/needs-info label and log success for a valid issue', async () => {
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
        labels: [{ name: 'triage/needs-info' }],
      },
    });

    const response = await request(app).post(WEBHOOK_ROUTE).send(validPayload);

    expect(response.status).toBe(200);
    expect(governanceGateway.removeLabel).toHaveBeenCalledWith({
      repositoryFullName: REPO_FULL_NAME,
      issueNumber: 12,
      label: 'triage/needs-info',
    });
    expect(governanceGateway.logValidatedIssue).toHaveBeenCalledWith({
      repositoryFullName: REPO_FULL_NAME,
      issueNumber: 12,
    });
  });

  it('should pass a valid issue with no labels without trying to remove labels', async () => {
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
        labels: [],
      },
    });

    const response = await request(app).post(WEBHOOK_ROUTE).send(validPayload);

    expect(response.status).toBe(200);
    expect(governanceGateway.removeLabel).not.toHaveBeenCalled();
    expect(governanceGateway.addLabels).not.toHaveBeenCalled();
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
    expect(governanceGateway.logValidatedIssue).toHaveBeenCalledWith({
      repositoryFullName: REPO_FULL_NAME,
      issueNumber: 12,
    });
  });

  it('should execute ai analysis for valid issue when analyzer dependency is provided', async () => {
    const governanceGateway: jest.Mocked<GovernanceGateway> = {
      addLabels: jest.fn().mockResolvedValue(undefined),
      removeLabel: jest.fn().mockResolvedValue(undefined),
      createComment: jest.fn().mockResolvedValue(undefined),
      logValidatedIssue: jest.fn().mockResolvedValue(undefined),
    };
    const analyzeIssueWithAi = createAiAnalyzerMock();
    const app = express();
    app.use(express.json());
    app.post(
      WEBHOOK_ROUTE,
      createGithubWebhookController({
        governanceGateway,
        analyzeIssueWithAi,
      }),
    );

    const response = await request(app).post(WEBHOOK_ROUTE).send(
      createPayload({
        action: 'opened',
      }),
    );

    expect(response.status).toBe(200);
    expect(analyzeIssueWithAi).toHaveBeenCalledWith({
      action: 'opened',
      repositoryFullName: REPO_FULL_NAME,
      issue: {
        number: 12,
        title: 'Bug in login flow',
        body: 'The app crashes when the user logs in from Safari in private mode.',
        labels: [],
      },
    });
  });

  it('should not process webhook when repository is not in allowlist', async () => {
    // Arrange
    const governanceGateway: jest.Mocked<GovernanceGateway> = {
      addLabels: jest.fn().mockResolvedValue(undefined),
      removeLabel: jest.fn().mockResolvedValue(undefined),
      createComment: jest.fn().mockResolvedValue(undefined),
      logValidatedIssue: jest.fn().mockResolvedValue(undefined),
    };
    const repositoryAuthorizationGateway = createRepositoryAuthorizationGatewayMock();
    repositoryAuthorizationGateway.isAllowed.mockReturnValue(false);
    const app = express();
    app.use(express.json());
    app.post(
      WEBHOOK_ROUTE,
      createGithubWebhookController({
        governanceGateway,
        repositoryAuthorizationGateway,
      }),
    );

    // Act
    const response = await request(app).post(WEBHOOK_ROUTE).send(createPayload());

    // Assert
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Repository not allowed' });
    expect(governanceGateway.addLabels).not.toHaveBeenCalled();
    expect(governanceGateway.removeLabel).not.toHaveBeenCalled();
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
    expect(governanceGateway.logValidatedIssue).not.toHaveBeenCalled();
  });

  it('should ignore duplicate webhook delivery id', async () => {
    // Arrange
    const governanceGateway: jest.Mocked<GovernanceGateway> = {
      addLabels: jest.fn().mockResolvedValue(undefined),
      removeLabel: jest.fn().mockResolvedValue(undefined),
      createComment: jest.fn().mockResolvedValue(undefined),
      logValidatedIssue: jest.fn().mockResolvedValue(undefined),
    };
    const webhookDeliveryGateway = createWebhookDeliveryGatewayMock();
    webhookDeliveryGateway.registerIfFirstSeen
      .mockResolvedValueOnce({ status: 'accepted' })
      .mockResolvedValueOnce({ status: 'duplicate' });
    const app = express();
    app.use(express.json());
    app.post(
      WEBHOOK_ROUTE,
      createGithubWebhookController({
        governanceGateway,
        webhookDeliveryGateway,
      }),
    );

    // Act
    const firstResponse = await request(app)
      .post(WEBHOOK_ROUTE)
      .set('x-github-delivery', 'delivery-123')
      .send(createPayload());
    const secondResponse = await request(app)
      .post(WEBHOOK_ROUTE)
      .set('x-github-delivery', 'delivery-123')
      .send(createPayload());

    // Assert
    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body).toEqual({ status: 'duplicate_ignored' });
    expect(governanceGateway.logValidatedIssue).toHaveBeenCalledTimes(1);
  });

  it('should reject webhook when delivery id is required but missing', async () => {
    // Arrange
    const governanceGateway: jest.Mocked<GovernanceGateway> = {
      addLabels: jest.fn().mockResolvedValue(undefined),
      removeLabel: jest.fn().mockResolvedValue(undefined),
      createComment: jest.fn().mockResolvedValue(undefined),
      logValidatedIssue: jest.fn().mockResolvedValue(undefined),
    };
    const app = express();
    app.use(express.json());
    app.post(
      WEBHOOK_ROUTE,
      createGithubWebhookController({
        governanceGateway,
        requireDeliveryId: true,
        webhookDeliveryGateway: createWebhookDeliveryGatewayMock(),
      }),
    );

    // Act
    const response = await request(app).post(WEBHOOK_ROUTE).send(createPayload());

    // Assert
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Missing X-GitHub-Delivery header' });
    expect(governanceGateway.logValidatedIssue).not.toHaveBeenCalled();
  });

  it('should allow retrying same delivery id after transient processing failure', async () => {
    // Arrange
    const governanceGateway: jest.Mocked<GovernanceGateway> = {
      addLabels: jest.fn().mockResolvedValue(undefined),
      removeLabel: jest.fn().mockResolvedValue(undefined),
      createComment: jest.fn().mockResolvedValue(undefined),
      logValidatedIssue: jest.fn().mockRejectedValueOnce(new Error('temporary failure')).mockResolvedValueOnce(undefined),
    };
    const webhookDeliveryGateway = createInMemoryWebhookDeliveryAdapter();
    const app = express();
    app.use(express.json());
    app.post(
      WEBHOOK_ROUTE,
      createGithubWebhookController({
        governanceGateway,
        webhookDeliveryGateway,
      }),
    );

    // Act
    const firstResponse = await request(app)
      .post(WEBHOOK_ROUTE)
      .set('x-github-delivery', 'delivery-retry-1')
      .send(createPayload());
    const secondResponse = await request(app)
      .post(WEBHOOK_ROUTE)
      .set('x-github-delivery', 'delivery-retry-1')
      .send(createPayload());

    // Assert
    expect(firstResponse.status).toBe(500);
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body).toEqual({ status: 'ok' });
    expect(governanceGateway.logValidatedIssue).toHaveBeenCalledTimes(2);
  });

  it('should process webhook when delivery id is present and delivery gateway is not configured', async () => {
    // Arrange
    const { app, governanceGateway } = setup();

    // Act
    const response = await request(app)
      .post(WEBHOOK_ROUTE)
      .set('x-github-delivery', 'delivery-no-gateway-1')
      .send(createPayload());

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(governanceGateway.logValidatedIssue).toHaveBeenCalledTimes(1);
  });

  it('should log rollback failure when unregister throws after processing failure', async () => {
    // Arrange
    const governanceGateway: jest.Mocked<GovernanceGateway> = {
      addLabels: jest.fn().mockResolvedValue(undefined),
      removeLabel: jest.fn().mockResolvedValue(undefined),
      createComment: jest.fn().mockResolvedValue(undefined),
      logValidatedIssue: jest.fn().mockRejectedValueOnce(new Error('temporary failure')),
    };
    const webhookDeliveryGateway: jest.Mocked<WebhookDeliveryGateway> = {
      registerIfFirstSeen: jest.fn().mockResolvedValue({ status: 'accepted' }),
      unregister: jest.fn().mockRejectedValue(new Error('rollback failed')),
    };
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const app = express();
    app.use(express.json());
    app.post(
      WEBHOOK_ROUTE,
      createGithubWebhookController({
        governanceGateway,
        webhookDeliveryGateway,
        logger,
      }),
    );

    // Act
    const response = await request(app)
      .post(WEBHOOK_ROUTE)
      .set('x-github-delivery', 'delivery-rollback-1')
      .send(createPayload());

    // Assert
    expect(response.status).toBe(500);
    expect(webhookDeliveryGateway.unregister).toHaveBeenCalledWith({
      source: WEBHOOK_DELIVERY_SOURCE_GITHUB,
      deliveryId: 'delivery-rollback-1',
    });
    expect(logger.error).toHaveBeenCalledWith(
      'GithubWebhookController failed to roll back webhook delivery registration.',
      expect.objectContaining({
        deliveryId: 'delivery-rollback-1',
        rollbackError: expect.any(Error),
      }),
    );
  });
});
