import {
  AI_CLASSIFICATION_CONFIDENCE_THRESHOLD,
  AI_KIND_LABELS,
  AI_SENTIMENT_CONFIDENCE_THRESHOLD,
} from '../constants/ai-triage.constants';
import { decideIssueKindLabelActions } from '../../domain/services/issue-kind-label-policy.service';
import { mapKindToLabel } from './issue-triage-labels.service';
import type { AiTriageGovernanceActionsExecutionContext } from './ai-triage-governance-actions-context.service';

export const applyClassificationGovernanceActions = async (
  context: AiTriageGovernanceActionsExecutionContext,
): Promise<void> => {
  const targetKindLabel = mapKindToLabel(context.aiAnalysis.classification.type);
  const classificationDecision = decideIssueKindLabelActions({
    targetKindLabel,
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
