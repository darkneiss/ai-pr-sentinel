import { Octokit } from '@octokit/rest';

import { createGithubRepositoryContextAdapter } from '../../../../src/features/triage/infrastructure/adapters/github-repository-context.adapter';

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({})),
}));

interface MockLogger {
  debug: jest.Mock<void, [string, ...unknown[]]>;
  info: jest.Mock<void, [string, ...unknown[]]>;
  error: jest.Mock<void, [string, ...unknown[]]>;
}

interface MockOctokit {
  repos: {
    getReadme: jest.Mock<Promise<unknown>, [unknown]>;
  };
}

const encodeBase64 = (value: string): string => Buffer.from(value, 'utf8').toString('base64');

const createMockOctokit = (): MockOctokit => ({
  repos: {
    getReadme: jest.fn().mockResolvedValue({
      data: {
        content: encodeBase64('# Repo\nSetup instructions'),
        encoding: 'base64',
      },
    }),
  },
});

const createMockLogger = (): MockLogger => ({
  debug: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
});

describe('GithubRepositoryContextAdapter', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return decoded readme content', async () => {
    // Arrange
    const octokit = createMockOctokit();
    const adapter = createGithubRepositoryContextAdapter({
      octokit: octokit as unknown as Octokit,
    });

    // Act
    const context = await adapter.findRepositoryContext({
      repositoryFullName: 'org/repo',
    });

    // Assert
    expect(context).toEqual({
      readme: '# Repo\nSetup instructions',
    });
    expect(octokit.repos.getReadme).toHaveBeenCalledWith({
      owner: 'org',
      repo: 'repo',
    });
  });

  it('should return empty context when README is not found', async () => {
    // Arrange
    const octokit = createMockOctokit();
    const logger = createMockLogger();
    octokit.repos.getReadme.mockRejectedValueOnce({ status: 404 });
    const adapter = createGithubRepositoryContextAdapter({
      octokit: octokit as unknown as Octokit,
      logger,
    });

    // Act
    const context = await adapter.findRepositoryContext({
      repositoryFullName: 'org/repo',
    });

    // Assert
    expect(context).toEqual({});
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('should throw and log when getReadme fails unexpectedly', async () => {
    // Arrange
    const octokit = createMockOctokit();
    const logger = createMockLogger();
    octokit.repos.getReadme.mockRejectedValueOnce(new Error('boom'));
    const adapter = createGithubRepositoryContextAdapter({
      octokit: octokit as unknown as Octokit,
      logger,
    });

    // Act
    await expect(
      adapter.findRepositoryContext({
        repositoryFullName: 'org/repo',
      }),
    ).rejects.toThrow('boom');

    // Assert
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
