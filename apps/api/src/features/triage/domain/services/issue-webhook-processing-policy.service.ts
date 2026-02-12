import { isIssueWebhookActionSupported } from './issue-webhook-action-policy.service';
import {
  parseIssueWebhookIdentity,
  type IssueWebhookIdentity,
} from './issue-webhook-identity-policy.service';

const WEBHOOK_SUCCESS_STATUS_CODE = 200 as const;
const WEBHOOK_NO_CONTENT_STATUS_CODE = 204 as const;

export interface DecideIssueWebhookProcessingInput {
  action: string;
  repositoryFullName: unknown;
  issueNumber: unknown;
}

export interface IssueWebhookProcessingDecision {
  shouldSkipProcessing: boolean;
  statusCode: 200 | 204;
  reason: 'unsupported_action' | 'malformed_issue_identity' | null;
  identity: IssueWebhookIdentity | null;
}

export const decideIssueWebhookProcessing = ({
  action,
  repositoryFullName,
  issueNumber,
}: DecideIssueWebhookProcessingInput): IssueWebhookProcessingDecision => {
  if (!isIssueWebhookActionSupported(action)) {
    return {
      shouldSkipProcessing: true,
      statusCode: WEBHOOK_NO_CONTENT_STATUS_CODE,
      reason: 'unsupported_action',
      identity: null,
    };
  }

  const identity = parseIssueWebhookIdentity({
    repositoryFullName,
    issueNumber,
  });
  if (!identity) {
    return {
      shouldSkipProcessing: true,
      statusCode: WEBHOOK_NO_CONTENT_STATUS_CODE,
      reason: 'malformed_issue_identity',
      identity: null,
    };
  }

  return {
    shouldSkipProcessing: false,
    statusCode: WEBHOOK_SUCCESS_STATUS_CODE,
    reason: null,
    identity,
  };
};
