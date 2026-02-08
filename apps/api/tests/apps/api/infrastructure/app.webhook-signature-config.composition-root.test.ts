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

describe('App (Webhook Signature Configuration)', () => {
  const originalVerifySignature = process.env.GITHUB_WEBHOOK_VERIFY_SIGNATURE;
  const originalWebhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  afterEach(() => {
    process.env.GITHUB_WEBHOOK_VERIFY_SIGNATURE = originalVerifySignature;
    process.env.GITHUB_WEBHOOK_SECRET = originalWebhookSecret;
    jest.clearAllMocks();
  });

  it('should fail fast when signature verification is enabled but secret is missing', () => {
    // Arrange
    delete process.env.GITHUB_WEBHOOK_SECRET;
    process.env.GITHUB_WEBHOOK_VERIFY_SIGNATURE = 'true';

    // Act + Assert
    expect(() => createApp()).toThrow(
      'Missing GITHUB_WEBHOOK_SECRET while GITHUB_WEBHOOK_VERIFY_SIGNATURE=true',
    );
  });

  it('should accept webhook requests without signature when verification is disabled', async () => {
    // Arrange
    delete process.env.GITHUB_WEBHOOK_SECRET;
    process.env.GITHUB_WEBHOOK_VERIFY_SIGNATURE = 'false';
    const governanceGateway = createGovernanceGatewayMock();
    const app = createApp({ governanceGateway });

    // Act
    const response = await request(app).post('/webhooks/github').send(createValidIssuePayload());

    // Assert
    expect(response.status).toBe(200);
  });
});
