import type { GovernanceGateway } from '../ports/governance-gateway.port';
import {
  GOVERNANCE_ERROR_LABELS,
  TRIAGE_NEEDS_INFO_LABEL,
} from '../constants/governance-labels.constants';
import { applyIssueWebhookGovernanceActions } from '../services/apply-issue-webhook-governance-actions.service';
import type {
  AnalyzeIssueWithAiInput,
  AnalyzeIssueWithAiResult,
} from '../ports/issue-ai-triage-runner.port';
import { type IssueIntegrityValidator } from '../../domain/services/issue-validation.service';
import { decideIssueWebhookWorkflow } from '../../domain/services/issue-webhook-workflow.service';

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
    const workflowDecision = decideIssueWebhookWorkflow({
      action: input.action,
      repositoryFullName: input.repositoryFullName,
      issue: input.issue,
      governanceErrorLabels: GOVERNANCE_ERROR_LABELS,
      needsInfoLabel: TRIAGE_NEEDS_INFO_LABEL,
      issueIntegrityValidator,
    });

    if (workflowDecision.shouldSkipProcessing || !workflowDecision.issueWebhookIdentity || !workflowDecision.governancePlan) {
      if (workflowDecision.reason === 'malformed_issue_identity') {
        logger.warn?.('ProcessIssueWebhookUseCase skipping supported action due to malformed issue identity input.', {
          action: input.action,
          repositoryFullName: input.repositoryFullName,
          issueNumber: input.issue.number,
        });
      }
      return { statusCode: workflowDecision.statusCode };
    }
    const issueWebhookIdentity = workflowDecision.issueWebhookIdentity;
    const governancePlan = workflowDecision.governancePlan;

    await applyIssueWebhookGovernanceActions({
      governanceGateway,
      issueWebhookIdentity,
      governancePlan,
    });

    if (!workflowDecision.shouldRunAiTriage) {
      return { statusCode: workflowDecision.statusCode };
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

    return { statusCode: workflowDecision.statusCode };
  };
