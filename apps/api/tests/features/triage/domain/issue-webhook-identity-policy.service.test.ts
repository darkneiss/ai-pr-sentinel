import {
  isValidIssueNumber,
  isValidRepositoryFullName,
  parseIssueWebhookIdentity,
} from '../../../../src/features/triage/domain/services/issue-webhook-identity-policy.service';

describe('IssueWebhookIdentityPolicyService', () => {
  it('should parse issue webhook identity when repository and issue number are valid', () => {
    // Arrange
    const input = {
      repositoryFullName: 'octo-org/ai-pr-sentinel',
      issueNumber: 42,
    };

    // Act
    const result = parseIssueWebhookIdentity(input);

    // Assert
    expect(result).toEqual({
      repositoryFullName: 'octo-org/ai-pr-sentinel',
      issueNumber: 42,
      issueId: 'octo-org/ai-pr-sentinel#42',
    });
  });

  it('should return null when issue webhook identity is malformed', () => {
    // Arrange
    const input = {
      repositoryFullName: 'invalid-repository-name',
      issueNumber: 3.5,
    };

    // Act
    const result = parseIssueWebhookIdentity(input);

    // Assert
    expect(result).toBeNull();
  });

  it('should validate repository full name using domain value object rules', () => {
    // Arrange
    const validRepository = 'octo-org/ai-pr-sentinel';
    const invalidRepository = 'invalid-repository-name';

    // Act
    const validResult = isValidRepositoryFullName(validRepository);
    const invalidResult = isValidRepositoryFullName(invalidRepository);

    // Assert
    expect(validResult).toBe(true);
    expect(invalidResult).toBe(false);
  });

  it('should validate issue number using domain value object rules', () => {
    // Arrange
    const validIssueNumber = 12;
    const invalidIssueNumber = 12.5;

    // Act
    const validResult = isValidIssueNumber(validIssueNumber);
    const invalidResult = isValidIssueNumber(invalidIssueNumber);

    // Assert
    expect(validResult).toBe(true);
    expect(invalidResult).toBe(false);
  });
});
