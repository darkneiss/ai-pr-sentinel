import {
  AI_CLASSIFICATION_CONFIDENCE_THRESHOLD,
  AI_KIND_BUG_LABEL,
  AI_KIND_FEATURE_LABEL,
  AI_KIND_LABELS,
  AI_KIND_QUESTION_LABEL,
  AI_SENTIMENT_CONFIDENCE_THRESHOLD,
} from '../constants/ai-triage.constants';
import {
  planIssueKindLabelActions,
  type IssueKindLabelActionsDecision,
} from '../../domain/services/issue-kind-label-policy.service';
import type { AiTriageGovernanceActionsExecutionContext } from './ai-triage-governance-actions-context.service';

export const applyClassificationGovernanceActions = async (
  context: AiTriageGovernanceActionsExecutionContext,
  plannedClassificationDecision?: IssueKindLabelActionsDecision,
): Promise<void> => {
  const classificationDecision =
    plannedClassificationDecision ??
    planIssueKindLabelActions({
      issueKind: context.aiAnalysis.classification.type,
      bugLabel: AI_KIND_BUG_LABEL,
      featureLabel: AI_KIND_FEATURE_LABEL,
      questionLabel: AI_KIND_QUESTION_LABEL,
      classificationConfidence: context.aiAnalysis.classification.confidence,
      classificationConfidenceThreshold: AI_CLASSIFICATION_CONFIDENCE_THRESHOLD,
      sentimentTone: context.aiAnalysis.sentiment.tone,
      sentimentConfidence: context.aiAnalysis.sentiment.confidence,
      sentimentConfidenceThreshold: AI_SENTIMENT_CONFIDENCE_THRESHOLD,
      existingLabels: Array.from(context.issueLabels),
      kindLabels: AI_KIND_LABELS,
    });

  for (const labelToRemove of classificationDecision.labelsToRemove) {
    await context.removeLabelIfPresent(labelToRemove);
  }

  for (const labelToAdd of classificationDecision.labelsToAdd) {
    await context.addLabelIfMissing(labelToAdd);
  }

  if (classificationDecision.wasSuppressedByHostileTone) {
    context.logger?.info?.('AnalyzeIssueWithAiUseCase kind labels suppressed due to hostile sentiment.', {
      repositoryFullName: context.repositoryFullName,
      issueNumber: context.issue.number,
      sentiment: context.aiAnalysis.sentiment,
    });
  }
};
