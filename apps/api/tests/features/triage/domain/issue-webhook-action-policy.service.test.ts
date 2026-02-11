import {
  isIssueWebhookActionSupported,
  ISSUE_WEBHOOK_SUPPORTED_ACTIONS,
} from '../../../../src/features/triage/domain/services/issue-webhook-action-policy.service';

describe('IssueWebhookActionPolicyService', () => {
  it('should include opened and edited as supported actions', () => {
    // Arrange
    const expectedActions = ['opened', 'edited'];

    // Act
    const result = [...ISSUE_WEBHOOK_SUPPORTED_ACTIONS];

    // Assert
    expect(result).toEqual(expectedActions);
  });

  it('should return true for supported webhook action', () => {
    // Arrange
    const action = 'opened';

    // Act
    const result = isIssueWebhookActionSupported(action);

    // Assert
    expect(result).toBe(true);
  });

  it('should return false for unsupported webhook action', () => {
    // Arrange
    const action = 'deleted';

    // Act
    const result = isIssueWebhookActionSupported(action);

    // Assert
    expect(result).toBe(false);
  });
});
