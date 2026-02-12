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
import { buildIssueWebhookGovernancePlan } from '../../domain/services/issue-webhook-governance-plan.service';
import { decideIssueWebhookProcessing } from '../../domain/services/issue-webhook-processing-policy.service';

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

export const processIssueWebhook =
  ({
    governanceGateway,
    issueIntegrityValidator,
    analyzeIssueWithAi,
    logger = console,
  }: Dependencies) =>
  async (input: ProcessIssueWebhookInput): Promise<ProcessIssueWebhookResult> => {
    const processingDecision = decideIssueWebhookProcessing({
      action: input.action,
      repositoryFullName: input.repositoryFullName,
      issueNumber: input.issue.number,
    });
    if (processingDecision.shouldSkipProcessing || !processingDecision.identity) {
      if (processingDecision.reason === 'malformed_issue_identity') {
        logger.warn?.('ProcessIssueWebhookUseCase skipping supported action due to malformed issue identity input.', {
          action: input.action,
          repositoryFullName: input.repositoryFullName,
          issueNumber: input.issue.number,
        });
      }
      return { statusCode: processingDecision.statusCode };
    }
    const issueWebhookIdentity = processingDecision.identity;

    const issueForValidation = IssueEntity.create({
      id: issueWebhookIdentity.issueId,
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

    for (const action of governancePlan.actions) {
      if (action.type === 'add_label') {
        await governanceGateway.addLabels({
          repositoryFullName: issueWebhookIdentity.repositoryFullName,
          issueNumber: issueWebhookIdentity.issueNumber,
          labels: [action.label],
        });
        continue;
      }

      if (action.type === 'remove_label') {
        await governanceGateway.removeLabel({
          repositoryFullName: issueWebhookIdentity.repositoryFullName,
          issueNumber: issueWebhookIdentity.issueNumber,
          label: action.label,
        });
        continue;
      }

      if (action.type === 'create_comment') {
        await governanceGateway.createComment({
          repositoryFullName: issueWebhookIdentity.repositoryFullName,
          issueNumber: issueWebhookIdentity.issueNumber,
          body: action.body,
        });
        continue;
      }

      await governanceGateway.logValidatedIssue({
        repositoryFullName: issueWebhookIdentity.repositoryFullName,
        issueNumber: issueWebhookIdentity.issueNumber,
      });
    }

    if (!governancePlan.shouldRunAiTriage) {
      return { statusCode: governancePlan.statusCode };
    }

    if (analyzeIssueWithAi) {
      try {
        logger.debug?.('ProcessIssueWebhookUseCase AI triage started.', {
          repositoryFullName: issueWebhookIdentity.repositoryFullName,
          issueNumber: issueWebhookIdentity.issueNumber,
          action: input.action,
        });

        const aiResult = await analyzeIssueWithAi({
          action: input.action,
          repositoryFullName: issueWebhookIdentity.repositoryFullName,
          issue: {
            number: issueWebhookIdentity.issueNumber,
            title: input.issue.title,
            body: input.issue.body,
            labels: input.issue.labels,
          },
        });

        logger.info?.('ProcessIssueWebhookUseCase AI triage completed.', {
          repositoryFullName: issueWebhookIdentity.repositoryFullName,
          issueNumber: issueWebhookIdentity.issueNumber,
          result: aiResult,
        });
      } catch (error: unknown) {
        logger.error('ProcessIssueWebhookUseCase failed running AI analysis. Applying fail-open policy.', {
          repositoryFullName: issueWebhookIdentity.repositoryFullName,
          issueNumber: issueWebhookIdentity.issueNumber,
          error,
        });
      }
    }

    return { statusCode: governancePlan.statusCode };
  };
