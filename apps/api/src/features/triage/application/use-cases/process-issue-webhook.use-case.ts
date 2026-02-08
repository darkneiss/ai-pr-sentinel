import type { GovernanceGateway } from '../ports/governance-gateway.port';
import {
  GOVERNANCE_ERROR_LABELS,
  TRIAGE_NEEDS_INFO_LABEL,
} from '../constants/governance-labels.constants';
import type { AnalyzeIssueWithAiInput, AnalyzeIssueWithAiResult } from './analyze-issue-with-ai.use-case';
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
  analyzeIssueWithAi?: (input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>;
  logger?: {
    debug?: (message: string, ...args: unknown[]) => void;
    info?: (message: string, ...args: unknown[]) => void;
    warn?: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
}

const isSupportedAction = (action: string): action is SupportedAction =>
  SUPPORTED_ACTIONS.includes(action as SupportedAction);

const buildValidationComment = (errors: string[]): string => {
  const lines = errors.map((error) => `- ${error}`);
  return ['Issue validation failed. Please fix the following items:', ...lines].join('\n');
};

export const processIssueWebhook =
  ({
    governanceGateway,
    issueIntegrityValidator = validateIssueIntegrity,
    analyzeIssueWithAi,
    logger = console,
  }: Dependencies) =>
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
      const hasNeedsInfoLabel = input.issue.labels.includes(TRIAGE_NEEDS_INFO_LABEL);
      if (hasNeedsInfoLabel) {
        return { statusCode: 200 };
      }

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

    if (analyzeIssueWithAi) {
      try {
        logger.debug?.('ProcessIssueWebhookUseCase AI triage started.', {
          repositoryFullName: input.repositoryFullName,
          issueNumber: input.issue.number,
          action: input.action,
        });

        const aiResult = await analyzeIssueWithAi({
          action: input.action,
          repositoryFullName: input.repositoryFullName,
          issue: {
            number: input.issue.number,
            title: input.issue.title,
            body: input.issue.body,
            labels: input.issue.labels,
          },
        });

        logger.info?.('ProcessIssueWebhookUseCase AI triage completed.', {
          repositoryFullName: input.repositoryFullName,
          issueNumber: input.issue.number,
          result: aiResult,
        });
      } catch (error: unknown) {
        logger.error('ProcessIssueWebhookUseCase failed running AI analysis. Applying fail-open policy.', {
          repositoryFullName: input.repositoryFullName,
          issueNumber: input.issue.number,
          error,
        });
      }
    }

    return { statusCode: 200 };
  };
