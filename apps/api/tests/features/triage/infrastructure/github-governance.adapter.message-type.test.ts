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

describe('GithubGovernanceAdapter (message type branch)', () => {
  it('should treat non-string response.data.message as undefined', async () => {
    // Arrange
    const octokit = createMockOctokit();
    const logger = createMockLogger();
    const apiError = {
      status: 500,
      response: {
        data: {
          message: 1234,
        },
      },
    };
    octokit.issues.addLabels.mockRejectedValueOnce(apiError);
    const adapter = createGithubGovernanceAdapter({
      octokit: octokit as unknown as Octokit,
      logger,
    });

    // Act
    await expect(
      adapter.addLabels({
        repositoryFullName: 'org/repo',
        issueNumber: 10,
        labels: ['triage/needs-info'],
      }),
    ).rejects.toEqual(apiError);

    // Assert
    expect(logger.error).toHaveBeenCalledWith(
      'GithubGovernanceAdapter failed adding labels',
      expect.objectContaining({
        githubResponseMessage: undefined,
      }),
    );
  });
});
