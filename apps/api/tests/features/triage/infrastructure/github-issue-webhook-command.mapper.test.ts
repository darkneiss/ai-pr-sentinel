import {
  mapGithubIssueWebhookToProcessCommand,
  type GithubIssueWebhookPayload,
} from '../../../../src/features/triage/infrastructure/adapters/github-issue-webhook-command.mapper';

const REPOSITORY_FULL_NAME = 'org/repo';

const createPayload = (overrides: Partial<GithubIssueWebhookPayload> = {}): GithubIssueWebhookPayload => ({
  action: 'opened',
  issue: {
    number: 42,
    title: 'Bug in login flow',
    body: 'The app crashes on login.',
    user: {
      login: 'dev_user',
    },
    labels: [{ name: 'triage/needs-info' }],
  },
  repository: {
    full_name: REPOSITORY_FULL_NAME,
  },
  ...overrides,
});

describe('GithubIssueWebhookCommandMapper', () => {
  it('should map a valid GitHub webhook payload into a process issue command', () => {
    // Arrange
    const payload = createPayload();

    // Act
    const result = mapGithubIssueWebhookToProcessCommand(payload);

    // Assert
    expect(result).toEqual({
      action: 'opened',
      repositoryFullName: REPOSITORY_FULL_NAME,
      issue: {
        number: 42,
        title: 'Bug in login flow',
        body: 'The app crashes on login.',
        author: 'dev_user',
        labels: ['triage/needs-info'],
      },
    });
  });

  it('should map null body into empty string for process issue command', () => {
    // Arrange
    const payload = createPayload({
      issue: {
        number: 42,
        title: 'Bug in login flow',
        body: null,
        user: {
          login: 'dev_user',
        },
        labels: [],
      },
    });

    // Act
    const result = mapGithubIssueWebhookToProcessCommand(payload);

    // Assert
    expect(result?.issue.body).toBe('');
  });

  it('should return null when payload shape is invalid', () => {
    // Arrange
    const payload = { garbage: true };

    // Act
    const result = mapGithubIssueWebhookToProcessCommand(payload);

    // Assert
    expect(result).toBeNull();
  });

  it('should return null when repository full_name format is invalid', () => {
    // Arrange
    const payload = createPayload({
      repository: {
        full_name: 'invalid-repository-name',
      },
    });

    // Act
    const result = mapGithubIssueWebhookToProcessCommand(payload);

    // Assert
    expect(result).toBeNull();
  });

  it('should return null when issue number is not a positive integer', () => {
    // Arrange
    const payload = createPayload({
      issue: {
        number: 3.5,
        title: 'Bug in login flow',
        body: 'The app crashes on login.',
        user: {
          login: 'dev_user',
        },
        labels: [],
      },
    });

    // Act
    const result = mapGithubIssueWebhookToProcessCommand(payload);

    // Assert
    expect(result).toBeNull();
  });
});
