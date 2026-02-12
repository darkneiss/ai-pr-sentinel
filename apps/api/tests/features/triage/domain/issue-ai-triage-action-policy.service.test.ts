import {
  AI_TRIAGE_SUPPORTED_ACTIONS,
  isIssueAiTriageActionSupported,
} from '../../../../src/features/triage/domain/services/issue-ai-triage-action-policy.service';

describe('IssueAiTriageActionPolicyService', () => {
  it('should expose opened and edited as supported ai triage actions', () => {
    // Arrange
    const expectedActions = ['opened', 'edited'];

    // Act
    const result = [...AI_TRIAGE_SUPPORTED_ACTIONS];

    // Assert
    expect(result).toEqual(expectedActions);
  });

  it('should return true when action is supported by ai triage policy', () => {
    // Arrange
    const action = 'edited';

    // Act
    const result = isIssueAiTriageActionSupported(action);

    // Assert
    expect(result).toBe(true);
  });

  it('should return false when action is not supported by ai triage policy', () => {
    // Arrange
    const action = 'reopened';

    // Act
    const result = isIssueAiTriageActionSupported(action);

    // Assert
    expect(result).toBe(false);
  });
});
