import request from 'supertest';

import type { GovernanceGateway } from '../../../../src/features/triage/application/ports/governance-gateway.port';
import { createApp } from '../../../../src/app';

const createGovernanceGatewayMock = (): jest.Mocked<GovernanceGateway> => ({
  addLabels: jest.fn().mockResolvedValue(undefined),
  removeLabel: jest.fn().mockResolvedValue(undefined),
  createComment: jest.fn().mockResolvedValue(undefined),
  logValidatedIssue: jest.fn().mockResolvedValue(undefined),
});

const createValidIssuePayload = () => ({
  action: 'opened',
  issue: {
    number: 42,
    title: 'Bug in login flow when network drops',
    body: 'Steps to reproduce: open app, disable network, submit login form, and check observed crash logs.',
    user: {
      login: 'dev_user',
    },
    labels: [],
  },
  repository: {
    full_name: 'org/repo',
  },
});

describe('App (Webhook Signature Defaults)', () => {
  const originalVerifySignature = process.env.GITHUB_WEBHOOK_VERIFY_SIGNATURE;
  const originalWebhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.GITHUB_WEBHOOK_VERIFY_SIGNATURE = originalVerifySignature;
    process.env.GITHUB_WEBHOOK_SECRET = originalWebhookSecret;
    process.env.NODE_ENV = originalNodeEnv;
    jest.clearAllMocks();
  });

  it('should not enforce signature in development when secret is empty', async () => {
    // Arrange
    delete process.env.GITHUB_WEBHOOK_VERIFY_SIGNATURE;
    process.env.NODE_ENV = 'development';
    delete process.env.GITHUB_WEBHOOK_SECRET;
    const app = createApp({ governanceGateway: createGovernanceGatewayMock() });

    // Act
    const response = await request(app).post('/webhooks/github').send(createValidIssuePayload());

    // Assert
    expect(response.status).toBe(200);
  });

  it('should enforce signature in development when secret is set', async () => {
    // Arrange
    delete process.env.GITHUB_WEBHOOK_VERIFY_SIGNATURE;
    process.env.NODE_ENV = 'development';
    process.env.GITHUB_WEBHOOK_SECRET = 'development-secret';
    const app = createApp({ governanceGateway: createGovernanceGatewayMock() });

    // Act
    const response = await request(app).post('/webhooks/github').send(createValidIssuePayload());

    // Assert
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Invalid webhook signature' });
  });
});
