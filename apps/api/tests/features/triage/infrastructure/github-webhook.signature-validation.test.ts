import crypto from 'node:crypto';
import express from 'express';
import request from 'supertest';

import { createGithubWebhookController } from '../../../../src/features/triage/infrastructure/controllers/github-webhook.controller';
import type { GovernanceGateway } from '../../../../src/features/triage/application/ports/governance-gateway.port';

const WEBHOOK_ROUTE = '/webhooks/github';
const WEBHOOK_SECRET = 'test-webhook-secret';

const createPayload = (): Record<string, unknown> => ({
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
    full_name: 'org/repo',
  },
});

const createSignature = (rawBody: string): string =>
  `sha256=${crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex')}`;

const createApp = () => {
  const governanceGateway: jest.Mocked<GovernanceGateway> = {
    addLabels: jest.fn().mockResolvedValue(undefined),
    removeLabel: jest.fn().mockResolvedValue(undefined),
    createComment: jest.fn().mockResolvedValue(undefined),
    logValidatedIssue: jest.fn().mockResolvedValue(undefined),
  };

  const app = express();
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        const requestWithRawBody = req as express.Request & { rawBody?: Buffer };
        requestWithRawBody.rawBody = Buffer.from(buf);
      },
    }),
  );
  app.post(
    WEBHOOK_ROUTE,
    createGithubWebhookController({
      governanceGateway,
      webhookSecret: WEBHOOK_SECRET,
    }),
  );

  return { app, governanceGateway };
};

describe('GithubWebhookController signature validation', () => {
  it('should accept webhook when x-hub-signature-256 is valid', async () => {
    // Arrange
    const { app } = createApp();
    const payload = JSON.stringify(createPayload());
    const signature = createSignature(payload);

    // Act
    const response = await request(app)
      .post(WEBHOOK_ROUTE)
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', signature)
      .send(payload);

    // Assert
    expect(response.status).toBe(200);
  });

  it('should reject webhook when x-hub-signature-256 is missing', async () => {
    // Arrange
    const { app } = createApp();
    const payload = JSON.stringify(createPayload());

    // Act
    const response = await request(app)
      .post(WEBHOOK_ROUTE)
      .set('Content-Type', 'application/json')
      .send(payload);

    // Assert
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Invalid webhook signature' });
  });

  it('should reject webhook when x-hub-signature-256 is invalid', async () => {
    // Arrange
    const { app } = createApp();
    const payload = JSON.stringify(createPayload());

    // Act
    const response = await request(app)
      .post(WEBHOOK_ROUTE)
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', 'sha256=deadbeef')
      .send(payload);

    // Assert
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Invalid webhook signature' });
  });
});
