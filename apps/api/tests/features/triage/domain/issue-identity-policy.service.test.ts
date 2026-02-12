import { buildIssueIdentity } from '../../../../src/features/triage/domain/services/issue-identity-policy.service';

describe('IssueIdentityPolicyService', () => {
  it('should compose a normalized issue identity from repository and number', () => {
    // Arrange
    const input = {
      repositoryFullName: '  org/repo  ',
      issueNumber: 42,
    };

    // Act
    const issueIdentity = buildIssueIdentity(input);

    // Assert
    expect(issueIdentity.value).toBe('org/repo#42');
  });

  it('should throw when repository full name is invalid', () => {
    // Arrange
    const act = (): void => {
      buildIssueIdentity({
        repositoryFullName: 'org',
        issueNumber: 42,
      });
    };

    // Act
    // Assert
    expect(act).toThrow('Invalid repository full name: "org"');
  });

  it('should throw when issue number is invalid', () => {
    // Arrange
    const act = (): void => {
      buildIssueIdentity({
        repositoryFullName: 'org/repo',
        issueNumber: 0,
      });
    };

    // Act
    // Assert
    expect(act).toThrow('Invalid issue number: "0"');
  });
});
