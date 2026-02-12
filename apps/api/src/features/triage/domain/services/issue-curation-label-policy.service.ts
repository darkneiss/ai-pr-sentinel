import type { AiIssueKind, AiLabelRecommendations, AiTone } from './issue-ai-analysis.types';

interface DecideIssueCurationLabelsInput {
  labelRecommendations: AiLabelRecommendations | undefined;
  existingLabels: string[];
  documentationLabel: string;
  helpWantedLabel: string;
  goodFirstIssueLabel: string;
  documentationConfidenceThreshold: number;
  helpWantedConfidenceThreshold: number;
  goodFirstIssueConfidenceThreshold: number;
  classificationType: AiIssueKind;
  classificationConfidence: number;
  classificationConfidenceThreshold: number;
  sentimentTone: AiTone;
  isLikelyDuplicate: boolean;
}

export interface IssueCurationLabelPlan {
  labelsToAdd: string[];
}

const shouldApplyRecommendation = (
  shouldApply: boolean | undefined,
  confidence: number | undefined,
  confidenceThreshold: number,
): boolean => {
  if (!shouldApply || confidence === undefined) {
    return false;
  }

  return confidence >= confidenceThreshold;
};

export const planIssueCurationLabels = ({
  labelRecommendations,
  existingLabels,
  documentationLabel,
  helpWantedLabel,
  goodFirstIssueLabel,
  documentationConfidenceThreshold,
  helpWantedConfidenceThreshold,
  goodFirstIssueConfidenceThreshold,
  classificationType,
  classificationConfidence,
  classificationConfidenceThreshold,
  sentimentTone,
  isLikelyDuplicate,
}: DecideIssueCurationLabelsInput): IssueCurationLabelPlan => {
  if (!labelRecommendations) {
    return { labelsToAdd: [] };
  }

  if (sentimentTone === 'hostile' || isLikelyDuplicate) {
    return { labelsToAdd: [] };
  }

  const labelsToAdd: string[] = [];
  const canRecommendDocumentation = classificationType === 'question' || classificationType === 'feature';
  const canRecommendGoodFirstIssue =
    (classificationType === 'question' || classificationType === 'feature') &&
    classificationConfidence >= classificationConfidenceThreshold;

  if (
    canRecommendDocumentation &&
    shouldApplyRecommendation(
      labelRecommendations.documentation?.shouldApply,
      labelRecommendations.documentation?.confidence,
      documentationConfidenceThreshold,
    ) &&
    !existingLabels.includes(documentationLabel)
  ) {
    labelsToAdd.push(documentationLabel);
  }

  if (
    shouldApplyRecommendation(
      labelRecommendations.helpWanted?.shouldApply,
      labelRecommendations.helpWanted?.confidence,
      helpWantedConfidenceThreshold,
    ) &&
    !existingLabels.includes(helpWantedLabel)
  ) {
    labelsToAdd.push(helpWantedLabel);
  }

  if (
    canRecommendGoodFirstIssue &&
    shouldApplyRecommendation(
      labelRecommendations.goodFirstIssue?.shouldApply,
      labelRecommendations.goodFirstIssue?.confidence,
      goodFirstIssueConfidenceThreshold,
    ) &&
    !existingLabels.includes(goodFirstIssueLabel)
  ) {
    labelsToAdd.push(goodFirstIssueLabel);
  }

  return { labelsToAdd };
};
