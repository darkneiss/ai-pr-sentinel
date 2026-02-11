import {
  shouldAddIssueLabel,
  shouldRemoveIssueLabel,
} from '../../../../src/features/triage/domain/services/issue-label-transition-policy.service';

describe('IssueLabelTransitionPolicyService', () => {
  it('should add label only when it is absent', () => {
    // Arrange
    const existingLabels = ['kind/bug', 'triage/monitor'];

    // Act
    const shouldAddMissingLabel = shouldAddIssueLabel({
      existingLabels,
      label: 'triage/duplicate',
    });
    const shouldAddExistingLabel = shouldAddIssueLabel({
      existingLabels,
      label: 'kind/bug',
    });

    // Assert
    expect(shouldAddMissingLabel).toBe(true);
    expect(shouldAddExistingLabel).toBe(false);
  });

  it('should remove label only when it is present', () => {
    // Arrange
    const existingLabels = ['kind/bug', 'triage/monitor'];

    // Act
    const shouldRemovePresentLabel = shouldRemoveIssueLabel({
      existingLabels,
      label: 'triage/monitor',
    });
    const shouldRemoveMissingLabel = shouldRemoveIssueLabel({
      existingLabels,
      label: 'triage/duplicate',
    });

    // Assert
    expect(shouldRemovePresentLabel).toBe(true);
    expect(shouldRemoveMissingLabel).toBe(false);
  });
});
