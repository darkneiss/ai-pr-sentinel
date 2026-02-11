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
import { IssueEntity } from '../../domain/entities/issue.entity';
import {
  buildIssueValidationComment,
  decideIssueGovernanceActions,
} from '../../domain/services/issue-governance-policy.service';
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

export const processIssueWebhook =
  ({
    governanceGateway,
    issueIntegrityValidator = validateIssueIntegrity,
    analyzeIssueWithAi,
    logger = console,
  }: Dependencies) =>
  async (input: ProcessIssueWebhookInput): Promise<ProcessIssueWebhookResult> => {
    if (!isIssueWebhookActionSupported(input.action)) {
      return { statusCode: 204 };
    }

    const issueForValidation = IssueEntity.create({
      id: `${input.repositoryFullName}#${input.issue.number}`,
      title: input.issue.title,
      description: input.issue.body,
      author: input.issue.author,
      createdAt: new Date(),
    });
    const validationResult = issueIntegrityValidator(issueForValidation);
    const governanceActionsDecision = decideIssueGovernanceActions({
      validation: validationResult,
      existingLabels: input.issue.labels,
      governanceErrorLabels: GOVERNANCE_ERROR_LABELS,
      needsInfoLabel: TRIAGE_NEEDS_INFO_LABEL,
    });

    if (governanceActionsDecision.shouldAddNeedsInfoLabel) {
      await governanceGateway.addLabels({
        repositoryFullName: input.repositoryFullName,
        issueNumber: input.issue.number,
        labels: [TRIAGE_NEEDS_INFO_LABEL],
      });
    }

    if (governanceActionsDecision.shouldCreateValidationComment) {
      await governanceGateway.createComment({
        repositoryFullName: input.repositoryFullName,
        issueNumber: input.issue.number,
        body: buildIssueValidationComment(governanceActionsDecision.validationErrors),
      });
    }

    if (!governanceActionsDecision.shouldLogValidatedIssue) {
      return { statusCode: 200 };
    }

    for (const label of governanceActionsDecision.labelsToRemove) {
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

    if (analyzeIssueWithAi && governanceActionsDecision.shouldRunAiTriage) {
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
