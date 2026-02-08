import { Octokit } from '@octokit/rest';

import { createGithubRepositoryContextAdapter } from '../../../../src/features/triage/infrastructure/adapters/github-repository-context.adapter';

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({})),
}));

interface MockOctokit {
  repos: {
    getReadme: jest.Mock<Promise<unknown>, [unknown]>;
  };
}

const createMockOctokit = (): MockOctokit => ({
  repos: {
    getReadme: jest.fn().mockResolvedValue({
      data: {
        content: Buffer.from('# Readme', 'utf8').toString('base64'),
        encoding: 'base64',
      },
    }),
  },
});

describe('GithubRepositoryContextAdapter (Extra Branches)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw on invalid repository full name format', async () => {
    // Arrange
    const octokit = createMockOctokit();
    const adapter = createGithubRepositoryContextAdapter({
      octokit: octokit as unknown as Octokit,
    });

    // Act
    await expect(
      adapter.findRepositoryContext({
        repositoryFullName: 'invalid-repo-name',
      }),
    ).rejects.toThrow('Invalid repository full name');
  });

  it('should throw when github token is missing and no octokit is injected', () => {
    // Arrange
    const currentToken = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;

    try {
      // Act + Assert
      expect(() => createGithubRepositoryContextAdapter()).toThrow(
        'Missing GitHub token. Provide "githubToken" or set GITHUB_TOKEN',
      );
    } finally {
      process.env.GITHUB_TOKEN = currentToken;
    }
  });

  it('should instantiate Octokit when githubToken is provided', () => {
    // Arrange
    const octokitCtorSpy = jest.mocked(Octokit);

    // Act
    createGithubRepositoryContextAdapter({ githubToken: 'fake-token' });

    // Assert
    expect(octokitCtorSpy).toHaveBeenCalledWith({ auth: 'fake-token' });
  });

  it('should return undefined readme when content is empty', async () => {
    // Arrange
    const octokit = createMockOctokit();
    octokit.repos.getReadme.mockResolvedValueOnce({
      data: {
        content: '',
        encoding: 'base64',
      },
    });
    const adapter = createGithubRepositoryContextAdapter({
      octokit: octokit as unknown as Octokit,
    });

    // Act
    const context = await adapter.findRepositoryContext({
      repositoryFullName: 'org/repo',
    });

    // Assert
    expect(context).toEqual({ readme: undefined });
  });

  it('should return undefined readme when encoding is not base64', async () => {
    // Arrange
    const octokit = createMockOctokit();
    octokit.repos.getReadme.mockResolvedValueOnce({
      data: {
        content: Buffer.from('# Readme', 'utf8').toString('base64'),
        encoding: 'utf8',
      },
    });
    const adapter = createGithubRepositoryContextAdapter({
      octokit: octokit as unknown as Octokit,
    });

    // Act
    const context = await adapter.findRepositoryContext({
      repositoryFullName: 'org/repo',
    });

    // Assert
    expect(context).toEqual({ readme: undefined });
  });
});
