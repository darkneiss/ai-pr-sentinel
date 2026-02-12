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

export type IssueWebhookGovernanceAction =
  | {
      type: 'add_label';
      label: string;
    }
  | {
      type: 'remove_label';
      label: string;
    }
  | {
      type: 'create_comment';
      body: string;
    }
  | {
      type: 'log_validated_issue';
    };

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
  actions: IssueWebhookGovernanceAction[];
  shouldAddNeedsInfoLabel: boolean;
  validationCommentBody: string | null;
  labelsToRemove: string[];
  shouldLogValidatedIssue: boolean;
  shouldRunAiTriage: boolean;
}

interface BuildIssueWebhookGovernanceActionsInput {
  needsInfoLabel: string;
  shouldAddNeedsInfoLabel: boolean;
  validationCommentBody: string | null;
  labelsToRemove: string[];
  shouldLogValidatedIssue: boolean;
}

const buildIssueWebhookGovernanceActions = ({
  needsInfoLabel,
  shouldAddNeedsInfoLabel,
  validationCommentBody,
  labelsToRemove,
  shouldLogValidatedIssue,
}: BuildIssueWebhookGovernanceActionsInput): IssueWebhookGovernanceAction[] => {
  const actions: IssueWebhookGovernanceAction[] = [];

  if (shouldAddNeedsInfoLabel) {
    actions.push({ type: 'add_label', label: needsInfoLabel });
  }

  if (validationCommentBody) {
    actions.push({ type: 'create_comment', body: validationCommentBody });
  }

  for (const labelToRemove of labelsToRemove) {
    actions.push({ type: 'remove_label', label: labelToRemove });
  }

  if (shouldLogValidatedIssue) {
    actions.push({ type: 'log_validated_issue' });
  }

  return actions;
};

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
      actions: [],
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
  const actions = buildIssueWebhookGovernanceActions({
    needsInfoLabel,
    shouldAddNeedsInfoLabel: governanceActionsDecision.shouldAddNeedsInfoLabel,
    validationCommentBody,
    labelsToRemove: governanceActionsDecision.labelsToRemove,
    shouldLogValidatedIssue: governanceActionsDecision.shouldLogValidatedIssue,
  });

  return {
    shouldSkipProcessing: false,
    statusCode: WEBHOOK_SUCCESS_STATUS_CODE,
    actions,
    shouldAddNeedsInfoLabel: governanceActionsDecision.shouldAddNeedsInfoLabel,
    validationCommentBody,
    labelsToRemove: governanceActionsDecision.labelsToRemove,
    shouldLogValidatedIssue: governanceActionsDecision.shouldLogValidatedIssue,
    shouldRunAiTriage: governanceActionsDecision.shouldRunAiTriage,
  };
};
