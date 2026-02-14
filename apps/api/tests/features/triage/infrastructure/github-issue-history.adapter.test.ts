import { Octokit } from '@octokit/rest';

import { createGithubIssueHistoryAdapter } from '../../../../src/features/triage/infrastructure/adapters/github-issue-history.adapter';

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({})),
}));

interface MockLogger {
  error: jest.Mock<void, [string, ...unknown[]]>;
}

interface MockListIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  labels: Array<{ name?: string | null } | string>;
  pull_request?: Record<string, unknown>;
}

interface MockOctokit {
  issues: {
    listForRepo: jest.Mock<Promise<{ data: MockListIssue[] }>, [unknown]>;
    listComments: jest.Mock<Promise<{ data: Array<{ body?: string; user?: { login?: string } }> }>, [unknown]>;
  };
}

const createMockOctokit = (): MockOctokit => ({
  issues: {
    listForRepo: jest.fn().mockResolvedValue({
      data: [
        {
          number: 3,
          title: 'Cannot login in Safari',
          state: 'open',
          labels: [{ name: 'kind/bug' }, { name: 'triage/needs-info' }],
        },
      ],
    }),
    listComments: jest.fn().mockResolvedValue({
      data: [
        {
          body: 'AI Triage: Suggested setup checklist\n\n- Step 1',
          user: { login: 'ai-pr-sentinel[bot]' },
        },
      ],
    }),
  },
});

const createMockLogger = (): MockLogger => ({
  error: jest.fn(),
});

describe('GithubIssueHistoryAdapter', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call GitHub listForRepo with parsed owner/repo and limit', async () => {
    // Arrange
    const octokit = createMockOctokit();
    const adapter = createGithubIssueHistoryAdapter({
      octokit: octokit as unknown as Octokit,
    });

    // Act
    await adapter.findRecentIssues({
      repositoryFullName: 'org/repo',
      limit: 15,
    });

    // Assert
    expect(octokit.issues.listForRepo).toHaveBeenCalledWith({
      owner: 'org',
      repo: 'repo',
      state: 'open',
      sort: 'created',
      direction: 'desc',
      per_page: 15,
      page: 1,
    });
  });

  it('should map GitHub issues into RecentIssueSummary format', async () => {
    // Arrange
    const octokit = createMockOctokit();
    const adapter = createGithubIssueHistoryAdapter({
      octokit: octokit as unknown as Octokit,
    });

    // Act
    const recentIssues = await adapter.findRecentIssues({
      repositoryFullName: 'org/repo',
      limit: 10,
    });

    // Assert
    expect(recentIssues).toEqual([
      {
        number: 3,
        title: 'Cannot login in Safari',
        state: 'open',
        labels: ['kind/bug', 'triage/needs-info'],
      },
    ]);
  });

  it('should keep string labels and discard empty label names', async () => {
    // Arrange
    const octokit = createMockOctokit();
    octokit.issues.listForRepo.mockResolvedValueOnce({
      data: [
        {
          number: 7,
          title: 'Feature request',
          state: 'open',
          labels: ['kind/feature', { name: null }, { name: '' }, { name: 'triage/needs-info' }],
        },
      ],
    });
    const adapter = createGithubIssueHistoryAdapter({
      octokit: octokit as unknown as Octokit,
    });

    // Act
    const recentIssues = await adapter.findRecentIssues({
      repositoryFullName: 'org/repo',
      limit: 10,
    });

    // Assert
    expect(recentIssues).toEqual([
      {
        number: 7,
        title: 'Feature request',
        state: 'open',
        labels: ['kind/feature', 'triage/needs-info'],
      },
    ]);
  });

  it('should exclude pull requests from recent issue results', async () => {
    // Arrange
    const octokit = createMockOctokit();
    octokit.issues.listForRepo.mockResolvedValueOnce({
      data: [
        {
          number: 3,
          title: 'Cannot login in Safari',
          state: 'open',
          labels: [{ name: 'kind/bug' }],
        },
        {
          number: 4,
          title: 'Improve README',
          state: 'open',
          labels: [{ name: 'documentation' }],
          pull_request: { url: 'https://api.github.com/repos/org/repo/pulls/4' },
        },
      ],
    });
    const adapter = createGithubIssueHistoryAdapter({
      octokit: octokit as unknown as Octokit,
    });

    // Act
    const recentIssues = await adapter.findRecentIssues({
      repositoryFullName: 'org/repo',
      limit: 10,
    });

    // Assert
    expect(recentIssues).toHaveLength(1);
    expect(recentIssues[0].number).toBe(3);
  });

  it('should throw if repositoryFullName has invalid format', async () => {
    // Arrange
    const octokit = createMockOctokit();
    const adapter = createGithubIssueHistoryAdapter({
      octokit: octokit as unknown as Octokit,
    });

    // Act + Assert
    await expect(
      adapter.findRecentIssues({
        repositoryFullName: 'invalid-repository-name',
        limit: 10,
      }),
    ).rejects.toThrow('Invalid repository full name');
  });

  it('should throw if github token is missing and no octokit is injected', () => {
    // Arrange
    const currentToken = process.env.SCM_TOKEN;
    delete process.env.SCM_TOKEN;

    try {
      // Act + Assert
      expect(() => createGithubIssueHistoryAdapter()).toThrow(
        'Missing GitHub token. Provide "githubToken" or set SCM_TOKEN',
      );
    } finally {
      process.env.SCM_TOKEN = currentToken;
    }
  });

  it('should create Octokit when githubToken is provided and no octokit is injected', () => {
    // Arrange
    const octokitCtorSpy = jest.mocked(Octokit);

    // Act
    createGithubIssueHistoryAdapter({ githubToken: 'fake-token' });

    // Assert
    expect(octokitCtorSpy).toHaveBeenCalledWith({ auth: 'fake-token' });
  });

  it('should log and throw when GitHub listForRepo fails', async () => {
    // Arrange
    const octokit = createMockOctokit();
    const logger = createMockLogger();
    octokit.issues.listForRepo.mockRejectedValueOnce(new Error('github-unavailable'));
    const adapter = createGithubIssueHistoryAdapter({
      octokit: octokit as unknown as Octokit,
      logger,
    });

    // Act + Assert
    await expect(
      adapter.findRecentIssues({
        repositoryFullName: 'org/repo',
        limit: 10,
      }),
    ).rejects.toThrow('github-unavailable');

    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('should detect existing comment by prefix and author login', async () => {
    // Arrange
    const octokit = createMockOctokit();
    const adapter = createGithubIssueHistoryAdapter({
      octokit: octokit as unknown as Octokit,
    });

    // Act
    const result = await adapter.hasIssueCommentWithPrefix({
      repositoryFullName: 'org/repo',
      issueNumber: 10,
      bodyPrefix: 'AI Triage: Suggested setup checklist',
      authorLogin: 'ai-pr-sentinel[bot]',
    });

    // Assert
    expect(result).toBe(true);
    expect(octokit.issues.listComments).toHaveBeenCalledWith({
      owner: 'org',
      repo: 'repo',
      issue_number: 10,
      per_page: 100,
      page: 1,
    });
  });

  it('should return false when comment prefix exists but author does not match', async () => {
    // Arrange
    const octokit = createMockOctokit();
    const adapter = createGithubIssueHistoryAdapter({
      octokit: octokit as unknown as Octokit,
    });

    // Act
    const result = await adapter.hasIssueCommentWithPrefix({
      repositoryFullName: 'org/repo',
      issueNumber: 10,
      bodyPrefix: 'AI Triage: Suggested setup checklist',
      authorLogin: 'different-bot',
    });

    // Assert
    expect(result).toBe(false);
  });

  it('should return true when comment prefix exists and author is not provided', async () => {
    // Arrange
    const octokit = createMockOctokit();
    const adapter = createGithubIssueHistoryAdapter({
      octokit: octokit as unknown as Octokit,
    });

    // Act
    const result = await adapter.hasIssueCommentWithPrefix({
      repositoryFullName: 'org/repo',
      issueNumber: 10,
      bodyPrefix: 'AI Triage: Suggested setup checklist',
    });

    // Assert
    expect(result).toBe(true);
  });

  it('should return false when no comment has the requested prefix', async () => {
    // Arrange
    const octokit = createMockOctokit();
    octokit.issues.listComments.mockResolvedValueOnce({
      data: [
        {
          body: 'Unrelated message',
          user: { login: 'ai-pr-sentinel[bot]' },
        },
      ],
    });
    const adapter = createGithubIssueHistoryAdapter({
      octokit: octokit as unknown as Octokit,
    });

    // Act
    const result = await adapter.hasIssueCommentWithPrefix({
      repositoryFullName: 'org/repo',
      issueNumber: 10,
      bodyPrefix: 'AI Triage: Suggested setup checklist',
    });

    // Assert
    expect(result).toBe(false);
  });

  it('should handle comments without body safely and return false', async () => {
    // Arrange
    const octokit = createMockOctokit();
    octokit.issues.listComments.mockResolvedValueOnce({
      data: [
        {
          user: { login: 'ai-pr-sentinel[bot]' },
        },
      ],
    });
    const adapter = createGithubIssueHistoryAdapter({
      octokit: octokit as unknown as Octokit,
    });

    // Act
    const result = await adapter.hasIssueCommentWithPrefix({
      repositoryFullName: 'org/repo',
      issueNumber: 10,
      bodyPrefix: 'AI Triage: Suggested setup checklist',
    });

    // Assert
    expect(result).toBe(false);
  });

  it('should log and throw when GitHub listComments fails', async () => {
    // Arrange
    const octokit = createMockOctokit();
    const logger = createMockLogger();
    octokit.issues.listComments.mockRejectedValueOnce(new Error('comments-unavailable'));
    const adapter = createGithubIssueHistoryAdapter({
      octokit: octokit as unknown as Octokit,
      logger,
    });

    // Act + Assert
    await expect(
      adapter.hasIssueCommentWithPrefix({
        repositoryFullName: 'org/repo',
        issueNumber: 10,
        bodyPrefix: 'AI Triage: Suggested setup checklist',
      }),
    ).rejects.toThrow('comments-unavailable');

    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
