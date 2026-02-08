import {
  AI_CLASSIFICATION_CONFIDENCE_THRESHOLD,
  AI_KIND_LABELS,
  AI_SENTIMENT_CONFIDENCE_THRESHOLD,
} from '../constants/ai-triage.constants';
import { mapKindToLabel } from './issue-triage-labels.service';
import type { AiTriageGovernanceActionsExecutionContext } from './ai-triage-governance-actions-context.service';

export const applyClassificationGovernanceActions = async (
  context: AiTriageGovernanceActionsExecutionContext,
): Promise<void> => {
  const shouldSuppressKindLabels =
    context.aiAnalysis.sentiment.tone === 'hostile' &&
    context.aiAnalysis.sentiment.confidence >= AI_SENTIMENT_CONFIDENCE_THRESHOLD;

  if (
    context.aiAnalysis.classification.confidence >= AI_CLASSIFICATION_CONFIDENCE_THRESHOLD &&
    !shouldSuppressKindLabels
  ) {
    const targetKindLabel = mapKindToLabel(context.aiAnalysis.classification.type);
    const labelsToRemove = AI_KIND_LABELS.filter(
      (label) => label !== targetKindLabel && context.issueLabels.has(label),
    );

    for (const labelToRemove of labelsToRemove) {
      await context.removeLabelIfPresent(labelToRemove);
    }

    await context.addLabelIfMissing(targetKindLabel);
    return;
  }

  if (!shouldSuppressKindLabels) {
    return;
  }

  const labelsToRemove = AI_KIND_LABELS.filter((label) => context.issueLabels.has(label));
  for (const labelToRemove of labelsToRemove) {
    await context.removeLabelIfPresent(labelToRemove);
  }
  context.logger?.info?.('AnalyzeIssueWithAiUseCase kind labels suppressed due to hostile sentiment.', {
    repositoryFullName: context.repositoryFullName,
    issueNumber: context.issue.number,
    sentiment: context.aiAnalysis.sentiment,
  });
};
