import {
  decideIssueKindSuppressionLogDecision,
  type IssueKindLabelActionsDecision,
} from '../../domain/services/issue-kind-label-policy.service';
import type { AiTriageGovernanceActionsExecutionContext } from './ai-triage-governance-actions-context.service';

const CLASSIFICATION_ACTION_PLAN_REQUIRED_ERROR = 'Classification action plan is required.';

export const applyClassificationGovernanceActions = async (
  context: AiTriageGovernanceActionsExecutionContext,
  plannedClassificationDecision: IssueKindLabelActionsDecision,
): Promise<void> => {
  if (!plannedClassificationDecision) {
    throw new Error(CLASSIFICATION_ACTION_PLAN_REQUIRED_ERROR);
  }

  const classificationDecision = plannedClassificationDecision;

  for (const labelToRemove of classificationDecision.labelsToRemove) {
    await context.removeLabelIfPresent(labelToRemove);
  }

  for (const labelToAdd of classificationDecision.labelsToAdd) {
    await context.addLabelIfMissing(labelToAdd);
  }

  const suppressionLogDecision = decideIssueKindSuppressionLogDecision({
    wasSuppressedByHostileTone: classificationDecision.wasSuppressedByHostileTone,
  });
  if (suppressionLogDecision.shouldLogSuppression) {
    context.logger?.info?.('AnalyzeIssueWithAiUseCase kind labels suppressed due to hostile sentiment.', {
      repositoryFullName: context.repositoryFullName,
      issueNumber: context.issue.number,
      sentiment: context.aiAnalysis.sentiment,
    });
  }
};
