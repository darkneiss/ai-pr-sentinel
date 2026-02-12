import type { GovernanceGateway } from '../ports/governance-gateway.port';
import {
  GOVERNANCE_ERROR_LABELS,
  TRIAGE_NEEDS_INFO_LABEL,
} from '../constants/governance-labels.constants';
import type { AnalyzeIssueWithAiInput, AnalyzeIssueWithAiResult } from './analyze-issue-with-ai.use-case';
import { type IssueIntegrityValidator } from '../../domain/services/issue-validation.service';
import { IssueEntity } from '../../domain/entities/issue.entity';
import { buildIssueIdentity } from '../../domain/services/issue-identity-policy.service';
import { buildIssueWebhookGovernancePlan } from '../../domain/services/issue-webhook-governance-plan.service';

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

    if (governancePlan.shouldAddNeedsInfoLabel) {
      await governanceGateway.addLabels({
        repositoryFullName: input.repositoryFullName,
        issueNumber: input.issue.number,
        labels: [TRIAGE_NEEDS_INFO_LABEL],
      });
    }

    if (governancePlan.validationCommentBody) {
      await governanceGateway.createComment({
        repositoryFullName: input.repositoryFullName,
        issueNumber: input.issue.number,
        body: governancePlan.validationCommentBody,
      });
    }

    if (!governancePlan.shouldLogValidatedIssue) {
      return { statusCode: governancePlan.statusCode };
    }

    for (const label of governancePlan.labelsToRemove) {
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

    if (analyzeIssueWithAi && governancePlan.shouldRunAiTriage) {
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
