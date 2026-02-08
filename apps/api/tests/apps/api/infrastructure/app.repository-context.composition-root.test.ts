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
const createLlmGatewayMock = jest.fn(() => ({
  generateJson: jest.fn().mockResolvedValue({ rawText: '{}' }),
}));
const createGithubIssueHistoryAdapterMock = jest.fn(() => ({
  findRecentIssues: jest.fn().mockResolvedValue([]),
  hasIssueCommentWithPrefix: jest.fn().mockResolvedValue(false),
}));
const createGithubRepositoryContextAdapterMock = jest.fn(() => ({
  findRepositoryContext: jest.fn().mockResolvedValue({
    readme: '# Setup\nUse pnpm install',
  }),
}));
const analyzeIssueWithAiRunnerMock = jest.fn().mockResolvedValue({ status: 'completed' });
const analyzeIssueWithAiFactoryMock = jest.fn((_dependencies: unknown) => analyzeIssueWithAiRunnerMock);

jest.mock('../../../../src/features/triage/infrastructure/adapters/github-governance.adapter', () => ({
  createGithubGovernanceAdapter: () => createGithubGovernanceAdapterMock(),
}));
jest.mock('../../../../src/infrastructure/composition/llm-gateway.factory', () => ({
  createLlmGateway: () => createLlmGatewayMock(),
}));
jest.mock('../../../../src/features/triage/infrastructure/adapters/github-issue-history.adapter', () => ({
  createGithubIssueHistoryAdapter: () => createGithubIssueHistoryAdapterMock(),
}));
jest.mock('../../../../src/features/triage/infrastructure/adapters/github-repository-context.adapter', () => ({
  createGithubRepositoryContextAdapter: () => createGithubRepositoryContextAdapterMock(),
}));
jest.mock('../../../../src/features/triage/application/use-cases/analyze-issue-with-ai.use-case', () => ({
  analyzeIssueWithAi: (dependencies: unknown) => analyzeIssueWithAiFactoryMock(dependencies),
}));

const createValidIssuePayload = () => ({
  action: 'opened',
  issue: {
    number: 42,
    title: 'How can I run this locally?',
    body: 'I need setup help for my environment and local execution.',
    user: {
      login: 'dev_user',
    },
    labels: [],
  },
  repository: {
    full_name: 'org/repo',
  },
});

describe('App (Repository Context Composition)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize repository context adapter when AI triage is enabled', async () => {
    // Arrange
    const currentAiTriageEnabled = process.env.AI_TRIAGE_ENABLED;
    process.env.AI_TRIAGE_ENABLED = 'true';
    const app = createApp();

    try {
      // Act
      const response = await request(app).post('/webhooks/github').send(createValidIssuePayload());

      // Assert
      expect(response.status).toBe(200);
      expect(createGithubRepositoryContextAdapterMock).toHaveBeenCalledTimes(1);
      expect(createLlmGatewayMock).toHaveBeenCalledTimes(1);
      expect(analyzeIssueWithAiFactoryMock).toHaveBeenCalledTimes(1);
      expect(analyzeIssueWithAiRunnerMock).toHaveBeenCalledTimes(1);
    } finally {
      process.env.AI_TRIAGE_ENABLED = currentAiTriageEnabled;
    }
  });
});
