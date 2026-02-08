import { Octokit } from '@octokit/rest';

import { createGithubRepositoryContextAdapter } from '../../../../src/features/triage/infrastructure/adapters/github-repository-context.adapter';

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({})),
}));

interface MockLogger {
  info: jest.Mock<void, [string, ...unknown[]]>;
  error: jest.Mock<void, [string, ...unknown[]]>;
}

interface MockOctokit {
  repos: {
    getReadme: jest.Mock<Promise<unknown>, [unknown]>;
  };
}

const createMockLogger = (): MockLogger => ({
  info: jest.fn(),
  error: jest.fn(),
});

const createMockOctokit = (): MockOctokit => ({
  repos: {
    getReadme: jest.fn().mockRejectedValue({ status: 403 }),
  },
});

describe('GithubRepositoryContextAdapter (Forbidden README)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should continue without README context when token cannot access repository contents', async () => {
    // Arrange
    const octokit = createMockOctokit();
    const logger = createMockLogger();
    const adapter = createGithubRepositoryContextAdapter({
      octokit: octokit as unknown as Octokit,
      logger,
    });

    // Act
    const result = await adapter.findRepositoryContext({
      repositoryFullName: 'org/repo',
    });

    // Assert
    expect(result).toEqual({});
    expect(logger.info).toHaveBeenCalledWith(
      'GithubRepositoryContextAdapter README access forbidden. Continuing without repository context.',
      expect.objectContaining({
        repositoryFullName: 'org/repo',
      }),
    );
    expect(logger.error).not.toHaveBeenCalled();
  });
});
