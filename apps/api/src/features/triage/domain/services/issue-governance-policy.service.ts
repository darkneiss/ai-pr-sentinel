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

const ISSUE_VALIDATION_COMMENT_HEADER = 'Issue validation failed. Please fix the following items:';
const ISSUE_VALIDATION_COMMENT_ITEM_PREFIX = '- ';
const ISSUE_VALIDATION_COMMENT_LINE_SEPARATOR = '\n';

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

export const buildIssueValidationComment = (validationErrors: readonly string[]): string => {
  const validationItems = validationErrors.map(
    (validationError) => `${ISSUE_VALIDATION_COMMENT_ITEM_PREFIX}${validationError}`,
  );

  return [ISSUE_VALIDATION_COMMENT_HEADER, ...validationItems].join(ISSUE_VALIDATION_COMMENT_LINE_SEPARATOR);
};
