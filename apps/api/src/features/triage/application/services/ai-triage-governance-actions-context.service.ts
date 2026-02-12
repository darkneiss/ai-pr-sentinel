import type { GovernanceGateway } from '../ports/governance-gateway.port';
import type { IssueHistoryGateway, RecentIssueSummary } from '../ports/issue-history-gateway.port';
import {
  decideIssueLabelAddExecution,
  decideIssueLabelRemoveExecution,
} from '../../domain/services/issue-label-transition-policy.service';
import type { AiAnalysis, AiTone } from '../../domain/services/issue-ai-analysis-normalizer.service';
import type { QuestionResponseMetricsPort } from '../../../../shared/application/ports/question-response-metrics.port';
import type { ConfigPort } from '../../../../shared/application/ports/config.port';

interface Logger {
  debug?: (message: string, ...args: unknown[]) => void;
  info?: (message: string, ...args: unknown[]) => void;
  error?: (message: string, ...args: unknown[]) => void;
}

interface IssuePayload {
  number: number;
  title: string;
  body: string;
  labels: string[];
}

export interface ApplyAiTriageGovernanceActionsInput {
  action: string;
  repositoryFullName: string;
  issue: IssuePayload;
  aiAnalysis: AiAnalysis;
  llmProvider: string;
  llmModel: string;
  repositoryReadme?: string;
  governanceGateway: GovernanceGateway;
  issueHistoryGateway: IssueHistoryGateway;
  recentIssues: RecentIssueSummary[];
  questionResponseMetrics?: QuestionResponseMetricsPort;
  botLogin?: string;
  config?: ConfigPort;
  logger?: Logger;
}

export interface ApplyAiTriageGovernanceActionsResult {
  actionsAppliedCount: number;
  effectiveTone: AiTone;
}

export interface AiTriageGovernanceActionsExecutionContext {
  action: string;
  repositoryFullName: string;
  issue: IssuePayload;
  aiAnalysis: AiAnalysis;
  llmProvider: string;
  llmModel: string;
  repositoryReadme?: string;
  governanceGateway: GovernanceGateway;
  issueHistoryGateway: IssueHistoryGateway;
  recentIssues: RecentIssueSummary[];
  questionResponseMetrics?: QuestionResponseMetricsPort;
  botLogin?: string;
  config?: ConfigPort;
  logger?: Logger;
  issueLabels: Set<string>;
  effectiveTone: AiTone;
  actionsAppliedCount: number;
  addLabelIfMissing: (label: string) => Promise<boolean>;
  removeLabelIfPresent: (label: string) => Promise<void>;
  incrementActionsAppliedCount: () => void;
}

export const createAiTriageGovernanceActionsExecutionContext = (
  input: ApplyAiTriageGovernanceActionsInput,
): AiTriageGovernanceActionsExecutionContext => {
  const issueLabels = new Set(input.issue.labels);
  let actionsAppliedCount = 0;

  const incrementActionsAppliedCount = (): void => {
    actionsAppliedCount += 1;
  };

  const addLabelIfMissing = async (label: string): Promise<boolean> => {
    const addExecutionDecision = decideIssueLabelAddExecution({ existingLabels: issueLabels, label });
    if (!addExecutionDecision.shouldApply) {
      input.logger?.debug?.('AnalyzeIssueWithAiUseCase label already present. Skipping add.', {
        repositoryFullName: input.repositoryFullName,
        issueNumber: input.issue.number,
        label,
        skipReason: addExecutionDecision.skipReason,
      });
      return false;
    }

    await input.governanceGateway.addLabels({
      repositoryFullName: input.repositoryFullName,
      issueNumber: input.issue.number,
      labels: [label],
    });
    issueLabels.add(label);
    incrementActionsAppliedCount();
    input.logger?.debug?.('AnalyzeIssueWithAiUseCase label added.', {
      repositoryFullName: input.repositoryFullName,
      issueNumber: input.issue.number,
      label,
    });
    return true;
  };

  const removeLabelIfPresent = async (label: string): Promise<void> => {
    const removeExecutionDecision = decideIssueLabelRemoveExecution({ existingLabels: issueLabels, label });
    if (!removeExecutionDecision.shouldApply) {
      input.logger?.debug?.('AnalyzeIssueWithAiUseCase label not present. Skipping remove.', {
        repositoryFullName: input.repositoryFullName,
        issueNumber: input.issue.number,
        label,
        skipReason: removeExecutionDecision.skipReason,
      });
      return;
    }

    await input.governanceGateway.removeLabel({
      repositoryFullName: input.repositoryFullName,
      issueNumber: input.issue.number,
      label,
    });
    issueLabels.delete(label);
    incrementActionsAppliedCount();
    input.logger?.debug?.('AnalyzeIssueWithAiUseCase label removed.', {
      repositoryFullName: input.repositoryFullName,
      issueNumber: input.issue.number,
      label,
    });
  };

  return {
    ...input,
    issueLabels,
    effectiveTone: input.aiAnalysis.sentiment.tone,
    get actionsAppliedCount() {
      return actionsAppliedCount;
    },
    addLabelIfMissing,
    removeLabelIfPresent,
    incrementActionsAppliedCount,
  };
};
