import { Octokit } from '@octokit/rest';

import { createGithubGovernanceAdapter } from '../../../../src/features/triage/infrastructure/adapters/github-governance.adapter';

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({})),
}));

interface MockLogger {
  info: jest.Mock<void, [string, ...unknown[]]>;
  error: jest.Mock<void, [string, ...unknown[]]>;
}

interface MockOctokit {
  issues: {
    addLabels: jest.Mock<Promise<unknown>, [unknown]>;
    removeLabel: jest.Mock<Promise<unknown>, [unknown]>;
    createComment: jest.Mock<Promise<unknown>, [unknown]>;
  };
}

const createMockOctokit = (): MockOctokit => ({
  issues: {
    addLabels: jest.fn().mockResolvedValue(undefined),
    removeLabel: jest.fn().mockResolvedValue(undefined),
    createComment: jest.fn().mockResolvedValue(undefined),
  },
});

const createMockLogger = (): MockLogger => ({
  info: jest.fn(),
  error: jest.fn(),
});

describe('GithubGovernanceAdapter', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call GitHub addLabels with parsed owner/repo', async () => {
    const octokit = createMockOctokit();
    const adapter = createGithubGovernanceAdapter({
      octokit: octokit as unknown as Octokit,
    });

    await adapter.addLabels({
      repositoryFullName: 'org/repo',
      issueNumber: 12,
      labels: ['triage/needs-info'],
    });

    expect(octokit.issues.addLabels).toHaveBeenCalledWith({
      owner: 'org',
      repo: 'repo',
      issue_number: 12,
      labels: ['triage/needs-info'],
    });
  });

  it('should throw and log error when addLabels fails', async () => {
    const octokit = createMockOctokit();
    const logger = createMockLogger();
    octokit.issues.addLabels.mockRejectedValue(new Error('add-labels-failed'));
    const adapter = createGithubGovernanceAdapter({
      octokit: octokit as unknown as Octokit,
      logger,
    });

    await expect(
      adapter.addLabels({
        repositoryFullName: 'org/repo',
        issueNumber: 12,
        labels: ['triage/needs-info'],
      }),
    ).rejects.toThrow('add-labels-failed');

    expect(logger.error).toHaveBeenCalled();
  });

  it('should log actionable permission hint when addLabels fails with 403', async () => {
    // Arrange
    const octokit = createMockOctokit();
    const logger = createMockLogger();
    const apiError = new Error('Resource not accessible by integration');
    (
      apiError as unknown as {
        status?: number;
        response?: { data?: { message?: string } };
      }
    ).status = 403;
    (
      apiError as unknown as {
        status?: number;
        response?: { data?: { message?: string } };
      }
    ).response = {
      data: {
        message: 'Resource not accessible by integration',
      },
    };
    octokit.issues.addLabels.mockRejectedValue(apiError);
    const adapter = createGithubGovernanceAdapter({
      octokit: octokit as unknown as Octokit,
      logger,
    });

    // Act
    await expect(
      adapter.addLabels({
        repositoryFullName: 'org/repo',
        issueNumber: 12,
        labels: ['triage/needs-info'],
      }),
    ).rejects.toThrow('Resource not accessible by integration');

    // Assert
    expect(logger.error).toHaveBeenCalledWith(
      'GithubGovernanceAdapter failed adding labels',
      expect.objectContaining({
        repositoryFullName: 'org/repo',
        issueNumber: 12,
        labels: ['triage/needs-info'],
        githubStatus: 403,
        errorMessage: 'Resource not accessible by integration',
        githubResponseMessage: 'Resource not accessible by integration',
        suggestion: expect.stringContaining('Check SCM_TOKEN permissions'),
      }),
    );
  });

  it('should create a comment using GitHub API', async () => {
    const octokit = createMockOctokit();
    const adapter = createGithubGovernanceAdapter({
      octokit: octokit as unknown as Octokit,
    });

    await adapter.createComment({
      repositoryFullName: 'org/repo',
      issueNumber: 12,
      body: 'Please add more details',
    });

    expect(octokit.issues.createComment).toHaveBeenCalledWith({
      owner: 'org',
      repo: 'repo',
      issue_number: 12,
      body: 'Please add more details',
    });
  });

  it('should throw and log error when createComment fails', async () => {
    const octokit = createMockOctokit();
    const logger = createMockLogger();
    octokit.issues.createComment.mockRejectedValue(new Error('create-comment-failed'));
    const adapter = createGithubGovernanceAdapter({
      octokit: octokit as unknown as Octokit,
      logger,
    });

    await expect(
      adapter.createComment({
        repositoryFullName: 'org/repo',
        issueNumber: 12,
        body: 'Please add more details',
      }),
    ).rejects.toThrow('create-comment-failed');

    expect(logger.error).toHaveBeenCalled();
  });

  it('should ignore removeLabel when GitHub returns 404', async () => {
    const octokit = createMockOctokit();
    const logger = createMockLogger();
    octokit.issues.removeLabel.mockRejectedValue({ status: 404 });
    const adapter = createGithubGovernanceAdapter({
      octokit: octokit as unknown as Octokit,
      logger,
    });

    await expect(
      adapter.removeLabel({
        repositoryFullName: 'org/repo',
        issueNumber: 12,
        label: 'invalid',
      }),
    ).resolves.toBeUndefined();

    expect(logger.info).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should throw and log error when removeLabel fails with non-404', async () => {
    const octokit = createMockOctokit();
    const logger = createMockLogger();
    const apiError = new Error('permission denied');
    (apiError as unknown as { status?: number }).status = 403;
    octokit.issues.removeLabel.mockRejectedValue(apiError);
    const adapter = createGithubGovernanceAdapter({
      octokit: octokit as unknown as Octokit,
      logger,
    });

    await expect(
      adapter.removeLabel({
        repositoryFullName: 'org/repo',
        issueNumber: 12,
        label: 'invalid',
      }),
    ).rejects.toThrow('permission denied');

    expect(logger.error).toHaveBeenCalled();
  });

  it('should throw if repositoryFullName has invalid format', async () => {
    const octokit = createMockOctokit();
    const adapter = createGithubGovernanceAdapter({
      octokit: octokit as unknown as Octokit,
    });

    await expect(
      adapter.addLabels({
        repositoryFullName: 'invalid-repository-name',
        issueNumber: 12,
        labels: ['triage/needs-info'],
      }),
    ).rejects.toThrow('Invalid repository full name');
  });

  it('should throw if github token is missing and no octokit is injected', () => {
    const currentToken = process.env.SCM_TOKEN;
    delete process.env.SCM_TOKEN;

    try {
      expect(() => createGithubGovernanceAdapter()).toThrow(
        'Missing GitHub token. Provide "githubToken" or set SCM_TOKEN',
      );
    } finally {
      process.env.SCM_TOKEN = currentToken;
    }
  });

  it('should create Octokit when githubToken is provided and no octokit is injected', () => {
    const octokitCtorSpy = jest.mocked(Octokit);

    createGithubGovernanceAdapter({ githubToken: 'fake-token' });

    expect(octokitCtorSpy).toHaveBeenCalledWith({ auth: 'fake-token' });
  });

  it('should log validated issue', async () => {
    const octokit = createMockOctokit();
    const logger = createMockLogger();
    const adapter = createGithubGovernanceAdapter({
      octokit: octokit as unknown as Octokit,
      logger,
    });

    await adapter.logValidatedIssue({
      repositoryFullName: 'org/repo',
      issueNumber: 12,
    });

    expect(logger.info).toHaveBeenCalled();
  });
});
