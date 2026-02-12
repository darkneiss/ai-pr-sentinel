import {
  decideIssueLabelAddExecution,
  decideIssueLabelRemoveExecution,
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

  it('should return add execution decision as skipped when label already exists', () => {
    // Arrange
    const input = {
      existingLabels: ['kind/bug', 'triage/monitor'],
      label: 'kind/bug',
    };

    // Act
    const result = decideIssueLabelAddExecution(input);

    // Assert
    expect(result).toEqual({
      shouldApply: false,
      skipReason: 'already_present',
    });
  });

  it('should return add execution decision as applicable when label is missing', () => {
    // Arrange
    const input = {
      existingLabels: ['kind/bug', 'triage/monitor'],
      label: 'triage/duplicate',
    };

    // Act
    const result = decideIssueLabelAddExecution(input);

    // Assert
    expect(result).toEqual({
      shouldApply: true,
      skipReason: null,
    });
  });

  it('should return remove execution decision as skipped when label is absent', () => {
    // Arrange
    const input = {
      existingLabels: ['kind/bug', 'triage/monitor'],
      label: 'triage/duplicate',
    };

    // Act
    const result = decideIssueLabelRemoveExecution(input);

    // Assert
    expect(result).toEqual({
      shouldApply: false,
      skipReason: 'not_present',
    });
  });

  it('should return remove execution decision as applicable when label exists', () => {
    // Arrange
    const input = {
      existingLabels: ['kind/bug', 'triage/monitor'],
      label: 'triage/monitor',
    };

    // Act
    const result = decideIssueLabelRemoveExecution(input);

    // Assert
    expect(result).toEqual({
      shouldApply: true,
      skipReason: null,
    });
  });
});
