import request from 'supertest';
import type { GovernanceGateway } from '../../../../src/features/triage/application/ports/governance-gateway.port';
import { createApp } from '../../../../src/app';

const adapterGatewayMock: jest.Mocked<GovernanceGateway> = {
  addLabels: jest.fn().mockResolvedValue(undefined),
  removeLabel: jest.fn().mockResolvedValue(undefined),
  createComment: jest.fn().mockResolvedValue(undefined),
  logValidatedIssue: jest.fn().mockResolvedValue(undefined),
};

const createGithubGovernanceAdapterMock = jest.fn(() => adapterGatewayMock);

jest.mock('../../../../src/features/triage/infrastructure/adapters/github-governance.adapter', () => ({
  createGithubGovernanceAdapter: () => createGithubGovernanceAdapterMock(),
}));

const createValidIssuePayload = (overrides: Record<string, unknown> = {}) => ({
  action: 'edited',
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
  ...overrides,
});

describe('App (Composition Root)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should pass health check', async () => {
    const app = createApp();
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        status: 'ok',
        version: expect.any(String),
      }),
    );
  });

  it('should have the GitHub webhook route mounted', async () => {
    const app = createApp();
    const response = await request(app).post('/webhooks/github').send({});
    
    expect(response.status).toBe(400);
  });
  
  it('should return 404 for unknown routes', async () => {
    const app = createApp();
    const response = await request(app).get('/unknown-route');
    expect(response.status).toBe(404);
  });

  it('should use lazy adapter and perform invalid-issue governance actions', async () => {
    const app = createApp();
    const invalidPayload = createValidIssuePayload({
      issue: {
        number: 42,
        title: 'bug',
        body: 'short',
        user: { login: 'dev_user' },
        labels: [],
      },
    });

    const response = await request(app).post('/webhooks/github').send(invalidPayload);

    expect(response.status).toBe(200);
    expect(createGithubGovernanceAdapterMock).toHaveBeenCalledTimes(1);
    expect(adapterGatewayMock.addLabels).toHaveBeenCalledTimes(1);
    expect(adapterGatewayMock.createComment).toHaveBeenCalledTimes(1);
  });

  it('should use lazy adapter and perform valid-issue governance actions', async () => {
    const app = createApp();
    const validPayload = createValidIssuePayload({
      issue: {
        number: 42,
        title: 'Bug in login flow when network drops',
        body: 'Steps to reproduce: open app, disable network, submit login form, and check observed crash logs.',
        user: { login: 'dev_user' },
        labels: [{ name: 'invalid' }],
      },
    });

    const response = await request(app).post('/webhooks/github').send(validPayload);

    expect(response.status).toBe(200);
    expect(createGithubGovernanceAdapterMock).toHaveBeenCalledTimes(1);
    expect(adapterGatewayMock.removeLabel).toHaveBeenCalledTimes(1);
    expect(adapterGatewayMock.logValidatedIssue).toHaveBeenCalledTimes(1);
  });

  it('should use default app version when npm_package_version is missing', async () => {
    const currentVersion = process.env.npm_package_version;
    delete process.env.npm_package_version;
    const app = createApp();

    try {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok', version: '1.0.0' });
    } finally {
      process.env.npm_package_version = currentVersion;
    }
  });

  it('should prioritize APP_VERSION over npm_package_version', async () => {
    const currentAppVersion = process.env.APP_VERSION;
    const currentNpmVersion = process.env.npm_package_version;
    process.env.APP_VERSION = '9.9.9';
    process.env.npm_package_version = '1.2.3';
    const app = createApp();

    try {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok', version: '9.9.9' });
    } finally {
      process.env.APP_VERSION = currentAppVersion;
      process.env.npm_package_version = currentNpmVersion;
    }
  });
});
