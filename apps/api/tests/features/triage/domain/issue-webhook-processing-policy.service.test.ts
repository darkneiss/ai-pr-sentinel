import { decideIssueWebhookProcessing } from '../../../../src/features/triage/domain/services/issue-webhook-processing-policy.service';

describe('IssueWebhookProcessingPolicyService', () => {
  it('should skip processing when action is not supported', () => {
    // Arrange
    const input = {
      action: 'deleted',
      repositoryFullName: 'org/repo',
      issueNumber: 12,
    };

    // Act
    const result = decideIssueWebhookProcessing(input);

    // Assert
    expect(result).toEqual({
      shouldSkipProcessing: true,
      statusCode: 204,
      reason: 'unsupported_action',
      identity: null,
    });
  });

  it('should skip processing when webhook identity is malformed', () => {
    // Arrange
    const input = {
      action: 'opened',
      repositoryFullName: 'invalid-repository-name',
      issueNumber: 3.5,
    };

    // Act
    const result = decideIssueWebhookProcessing(input);

    // Assert
    expect(result).toEqual({
      shouldSkipProcessing: true,
      statusCode: 204,
      reason: 'malformed_issue_identity',
      identity: null,
    });
  });

  it('should continue processing when action and identity are valid', () => {
    // Arrange
    const input = {
      action: 'opened',
      repositoryFullName: 'org/repo',
      issueNumber: 12,
    };

    // Act
    const result = decideIssueWebhookProcessing(input);

    // Assert
    expect(result).toEqual({
      shouldSkipProcessing: false,
      statusCode: 200,
      reason: null,
      identity: {
        repositoryFullName: 'org/repo',
        issueNumber: 12,
        issueId: 'org/repo#12',
      },
    });
  });
});
