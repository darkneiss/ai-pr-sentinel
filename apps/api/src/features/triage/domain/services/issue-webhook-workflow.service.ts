import type { IssueEntity } from '../entities/issue.entity';
import { IssueEntity as DomainIssueEntity } from '../entities/issue.entity';
import type { IssueIntegrityValidator } from './issue-validation.service';
import {
  buildIssueWebhookGovernancePlan,
  type IssueWebhookGovernancePlan,
} from './issue-webhook-governance-plan.service';
import {
  decideIssueWebhookProcessing,
  type IssueWebhookProcessingDecision,
} from './issue-webhook-processing-policy.service';

export interface DecideIssueWebhookWorkflowInput {
  action: string;
  repositoryFullName: string;
  issue: {
    number: number;
    title: string;
    body: string;
    author: string;
    labels: string[];
  };
  governanceErrorLabels?: readonly string[];
  needsInfoLabel?: string;
  issueIntegrityValidator?: IssueIntegrityValidator;
}

export interface IssueWebhookWorkflowDecision {
  statusCode: 200 | 204;
  shouldSkipProcessing: boolean;
  shouldRunAiTriage: boolean;
  reason: IssueWebhookProcessingDecision['reason'];
  issueWebhookIdentity: IssueWebhookProcessingDecision['identity'];
  issueForValidation: IssueEntity | null;
  governancePlan: IssueWebhookGovernancePlan | null;
}

const DEFAULT_GOVERNANCE_ERROR_LABELS: readonly string[] = [];
const DEFAULT_NEEDS_INFO_LABEL = 'triage/needs-info';

export const decideIssueWebhookWorkflow = ({
  action,
  repositoryFullName,
  issue,
  governanceErrorLabels = DEFAULT_GOVERNANCE_ERROR_LABELS,
  needsInfoLabel = DEFAULT_NEEDS_INFO_LABEL,
  issueIntegrityValidator,
}: DecideIssueWebhookWorkflowInput): IssueWebhookWorkflowDecision => {
  const processingDecision = decideIssueWebhookProcessing({
    action,
    repositoryFullName,
    issueNumber: issue.number,
  });
  if (processingDecision.shouldSkipProcessing || !processingDecision.identity) {
    return {
      statusCode: processingDecision.statusCode,
      shouldSkipProcessing: true,
      shouldRunAiTriage: false,
      reason: processingDecision.reason,
      issueWebhookIdentity: null,
      issueForValidation: null,
      governancePlan: null,
    };
  }

  const issueForValidation = DomainIssueEntity.create({
    id: processingDecision.identity.issueId,
    title: issue.title,
    description: issue.body,
    author: issue.author,
    createdAt: new Date(),
  });
  const governancePlan = buildIssueWebhookGovernancePlan({
    action,
    issue: issueForValidation,
    existingLabels: issue.labels,
    governanceErrorLabels,
    needsInfoLabel,
    issueIntegrityValidator,
  });

  return {
    statusCode: governancePlan.statusCode,
    shouldSkipProcessing: false,
    shouldRunAiTriage: governancePlan.shouldRunAiTriage,
    reason: null,
    issueWebhookIdentity: processingDecision.identity,
    issueForValidation,
    governancePlan,
  };
};
