export interface IssueLabelTransitionInput {
  existingLabels: ReadonlySet<string> | readonly string[];
  label: string;
}

export type IssueLabelAddExecutionDecision =
  | {
      shouldApply: false;
      skipReason: 'already_present';
    }
  | {
      shouldApply: true;
      skipReason: null;
    };

export type IssueLabelRemoveExecutionDecision =
  | {
      shouldApply: false;
      skipReason: 'not_present';
    }
  | {
      shouldApply: true;
      skipReason: null;
    };

const isReadonlyLabelArray = (
  existingLabels: ReadonlySet<string> | readonly string[],
): existingLabels is readonly string[] => Array.isArray(existingLabels);

const hasIssueLabel = ({ existingLabels, label }: IssueLabelTransitionInput): boolean => {
  if (isReadonlyLabelArray(existingLabels)) {
    return existingLabels.includes(label);
  }

  return existingLabels.has(label);
};

export const shouldAddIssueLabel = (input: IssueLabelTransitionInput): boolean => !hasIssueLabel(input);

export const shouldRemoveIssueLabel = (input: IssueLabelTransitionInput): boolean => hasIssueLabel(input);

export const decideIssueLabelAddExecution = (
  input: IssueLabelTransitionInput,
): IssueLabelAddExecutionDecision => {
  if (!shouldAddIssueLabel(input)) {
    return {
      shouldApply: false,
      skipReason: 'already_present',
    };
  }

  return {
    shouldApply: true,
    skipReason: null,
  };
};

export const decideIssueLabelRemoveExecution = (
  input: IssueLabelTransitionInput,
): IssueLabelRemoveExecutionDecision => {
  if (!shouldRemoveIssueLabel(input)) {
    return {
      shouldApply: false,
      skipReason: 'not_present',
    };
  }

  return {
    shouldApply: true,
    skipReason: null,
  };
};
