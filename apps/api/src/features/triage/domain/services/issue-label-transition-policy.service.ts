export interface IssueLabelTransitionInput {
  existingLabels: ReadonlySet<string> | readonly string[];
  label: string;
}

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
