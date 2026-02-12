import type { GovernanceGateway } from '../ports/governance-gateway.port';
import {
  GOVERNANCE_ERROR_LABELS,
  TRIAGE_NEEDS_INFO_LABEL,
} from '../constants/governance-labels.constants';
import type {
  AnalyzeIssueWithAiInput,
  AnalyzeIssueWithAiResult,
} from '../ports/issue-ai-triage-runner.port';
import { type IssueIntegrityValidator } from '../../domain/services/issue-validation.service';
import { IssueEntity } from '../../domain/entities/issue.entity';
import { buildIssueIdentity } from '../../domain/services/issue-identity-policy.service';
import { buildIssueWebhookGovernancePlan } from '../../domain/services/issue-webhook-governance-plan.service';
import { isIssueWebhookActionSupported } from '../../domain/services/issue-webhook-action-policy.service';

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

const WEBHOOK_NO_CONTENT_STATUS_CODE = 204 as const;

export const processIssueWebhook =
  ({
    governanceGateway,
    issueIntegrityValidator,
    analyzeIssueWithAi,
    logger = console,
  }: Dependencies) =>
  async (input: ProcessIssueWebhookInput): Promise<ProcessIssueWebhookResult> => {
    if (!isIssueWebhookActionSupported(input.action)) {
      return { statusCode: WEBHOOK_NO_CONTENT_STATUS_CODE };
    }

    const issueForValidation = IssueEntity.create({
      id: buildIssueIdentity({
        repositoryFullName: input.repositoryFullName,
        issueNumber: input.issue.number,
      }).value,
      title: input.issue.title,
      description: input.issue.body,
      author: input.issue.author,
      createdAt: new Date(),
    });
    const governancePlan = buildIssueWebhookGovernancePlan({
      action: input.action,
      issue: issueForValidation,
      existingLabels: input.issue.labels,
      governanceErrorLabels: GOVERNANCE_ERROR_LABELS,
      needsInfoLabel: TRIAGE_NEEDS_INFO_LABEL,
      issueIntegrityValidator,
    });

    if (governancePlan.shouldSkipProcessing) {
      return { statusCode: governancePlan.statusCode };
    }

    for (const action of governancePlan.actions) {
      if (action.type === 'add_label') {
        await governanceGateway.addLabels({
          repositoryFullName: input.repositoryFullName,
          issueNumber: input.issue.number,
          labels: [action.label],
        });
        continue;
      }

      if (action.type === 'remove_label') {
        await governanceGateway.removeLabel({
          repositoryFullName: input.repositoryFullName,
          issueNumber: input.issue.number,
          label: action.label,
        });
        continue;
      }

      if (action.type === 'create_comment') {
        await governanceGateway.createComment({
          repositoryFullName: input.repositoryFullName,
          issueNumber: input.issue.number,
          body: action.body,
        });
        continue;
      }

      await governanceGateway.logValidatedIssue({
        repositoryFullName: input.repositoryFullName,
        issueNumber: input.issue.number,
      });
    }

    if (!governancePlan.shouldRunAiTriage) {
      return { statusCode: governancePlan.statusCode };
    }

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

    return { statusCode: governancePlan.statusCode };
  };
