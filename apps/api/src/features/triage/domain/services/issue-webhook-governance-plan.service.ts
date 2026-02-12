import type { IssueEntity } from '../entities/issue.entity';
import {
  buildIssueValidationComment,
  decideIssueGovernanceActions,
} from './issue-governance-policy.service';
import { isIssueWebhookActionSupported } from './issue-webhook-action-policy.service';
import {
  validateIssueIntegrity,
  type IssueIntegrityValidator,
} from './issue-validation.service';

const WEBHOOK_SUCCESS_STATUS_CODE = 200 as const;
const WEBHOOK_NO_CONTENT_STATUS_CODE = 204 as const;

export interface BuildIssueWebhookGovernancePlanInput {
  action: string;
  issue: IssueEntity;
  existingLabels: string[];
  governanceErrorLabels: readonly string[];
  needsInfoLabel: string;
  issueIntegrityValidator?: IssueIntegrityValidator;
}

export interface IssueWebhookGovernancePlan {
  shouldSkipProcessing: boolean;
  statusCode: 200 | 204;
  shouldAddNeedsInfoLabel: boolean;
  validationCommentBody: string | null;
  labelsToRemove: string[];
  shouldLogValidatedIssue: boolean;
  shouldRunAiTriage: boolean;
}

export const buildIssueWebhookGovernancePlan = ({
  action,
  issue,
  existingLabels,
  governanceErrorLabels,
  needsInfoLabel,
  issueIntegrityValidator = validateIssueIntegrity,
}: BuildIssueWebhookGovernancePlanInput): IssueWebhookGovernancePlan => {
  if (!isIssueWebhookActionSupported(action)) {
    return {
      shouldSkipProcessing: true,
      statusCode: WEBHOOK_NO_CONTENT_STATUS_CODE,
      shouldAddNeedsInfoLabel: false,
      validationCommentBody: null,
      labelsToRemove: [],
      shouldLogValidatedIssue: false,
      shouldRunAiTriage: false,
    };
  }

  const validationResult = issueIntegrityValidator(issue);
  const governanceActionsDecision = decideIssueGovernanceActions({
    validation: validationResult,
    existingLabels,
    governanceErrorLabels,
    needsInfoLabel,
  });
  const validationCommentBody = governanceActionsDecision.shouldCreateValidationComment
    ? buildIssueValidationComment(governanceActionsDecision.validationErrors)
    : null;

  return {
    shouldSkipProcessing: false,
    statusCode: WEBHOOK_SUCCESS_STATUS_CODE,
    shouldAddNeedsInfoLabel: governanceActionsDecision.shouldAddNeedsInfoLabel,
    validationCommentBody,
    labelsToRemove: governanceActionsDecision.labelsToRemove,
    shouldLogValidatedIssue: governanceActionsDecision.shouldLogValidatedIssue,
    shouldRunAiTriage: governanceActionsDecision.shouldRunAiTriage,
  };
};
