import type { GovernanceGateway } from '../ports/governance-gateway.port';
import {
  GOVERNANCE_ERROR_LABELS,
  TRIAGE_NEEDS_INFO_LABEL,
} from '../constants/governance-labels.constants';
import {
  validateIssueIntegrity,
  type IssueIntegrityValidator,
} from '../../domain/services/issue-validation.service';

const SUPPORTED_ACTIONS = ['opened', 'edited'] as const;

type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

export interface ProcessIssueWebhookInput {
  action: string;
  repositoryFullName: string;
  issue: {
    number: number;
    title: string;
    body: string;
    author: string;
    labels: string[];
  };
}

export interface ProcessIssueWebhookResult {
  statusCode: 200 | 204;
}

interface Dependencies {
  governanceGateway: GovernanceGateway;
  issueIntegrityValidator?: IssueIntegrityValidator;
}

const isSupportedAction = (action: string): action is SupportedAction =>
  SUPPORTED_ACTIONS.includes(action as SupportedAction);

const buildValidationComment = (errors: string[]): string => {
  const lines = errors.map((error) => `- ${error}`);
  return ['Issue validation failed. Please fix the following items:', ...lines].join('\n');
};

export const processIssueWebhook =
  ({ governanceGateway, issueIntegrityValidator = validateIssueIntegrity }: Dependencies) =>
  async (input: ProcessIssueWebhookInput): Promise<ProcessIssueWebhookResult> => {
    if (!isSupportedAction(input.action)) {
      return { statusCode: 204 };
    }

    const validationResult = issueIntegrityValidator({
      id: `${input.repositoryFullName}#${input.issue.number}`,
      title: input.issue.title,
      description: input.issue.body,
      author: input.issue.author,
      createdAt: new Date(),
    });

    if (!validationResult.isValid) {
      await governanceGateway.addLabels({
        repositoryFullName: input.repositoryFullName,
        issueNumber: input.issue.number,
        labels: [TRIAGE_NEEDS_INFO_LABEL],
      });
      await governanceGateway.createComment({
        repositoryFullName: input.repositoryFullName,
        issueNumber: input.issue.number,
        body: buildValidationComment(validationResult.errors),
      });

      return { statusCode: 200 };
    }

    const labelsToRemove = GOVERNANCE_ERROR_LABELS.filter((label) => input.issue.labels.includes(label));
    for (const label of labelsToRemove) {
      await governanceGateway.removeLabel({
        repositoryFullName: input.repositoryFullName,
        issueNumber: input.issue.number,
        label,
      });
    }

    await governanceGateway.logValidatedIssue({
      repositoryFullName: input.repositoryFullName,
      issueNumber: input.issue.number,
    });

    return { statusCode: 200 };
  };
