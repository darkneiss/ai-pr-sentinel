import type { IssueIntegrityValidationResult } from '../entities/issue.entity';

export interface DecideIssueGovernanceActionsInput {
  validation: IssueIntegrityValidationResult;
  existingLabels: string[];
  governanceErrorLabels: readonly string[];
  needsInfoLabel: string;
}

export interface IssueGovernanceActionsDecision {
  shouldAddNeedsInfoLabel: boolean;
  shouldCreateValidationComment: boolean;
  shouldLogValidatedIssue: boolean;
  shouldRunAiTriage: boolean;
  labelsToRemove: string[];
  validationErrors: string[];
}

export const decideIssueGovernanceActions = ({
  validation,
  existingLabels,
  governanceErrorLabels,
  needsInfoLabel,
}: DecideIssueGovernanceActionsInput): IssueGovernanceActionsDecision => {
  if (!validation.isValid) {
    const hasNeedsInfoLabel = existingLabels.includes(needsInfoLabel);

    return {
      shouldAddNeedsInfoLabel: !hasNeedsInfoLabel,
      shouldCreateValidationComment: !hasNeedsInfoLabel,
      shouldLogValidatedIssue: false,
      shouldRunAiTriage: false,
      labelsToRemove: [],
      validationErrors: [...validation.errors],
    };
  }

  const labelsToRemove = governanceErrorLabels.filter((label) => existingLabels.includes(label));

  return {
    shouldAddNeedsInfoLabel: false,
    shouldCreateValidationComment: false,
    shouldLogValidatedIssue: true,
    shouldRunAiTriage: true,
    labelsToRemove,
    validationErrors: [],
  };
};
