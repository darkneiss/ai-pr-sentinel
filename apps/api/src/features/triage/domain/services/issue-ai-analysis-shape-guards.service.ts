import {
  type AiAnalysis,
  type AiLabelRecommendation,
  type AiLabelRecommendations,
  isAiIssueKind,
  isAiTone,
  isConfidence,
  isObjectRecord,
} from './issue-ai-analysis.types';

const isAiLabelRecommendation = (value: unknown): value is AiLabelRecommendation => {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.shouldApply === 'boolean' &&
    isConfidence(value.confidence) &&
    (value.reasoning === undefined || typeof value.reasoning === 'string')
  );
};

const isAiLabelRecommendations = (value: unknown): value is AiLabelRecommendations => {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    (value.documentation === undefined || isAiLabelRecommendation(value.documentation)) &&
    (value.helpWanted === undefined || isAiLabelRecommendation(value.helpWanted)) &&
    (value.goodFirstIssue === undefined || isAiLabelRecommendation(value.goodFirstIssue))
  );
};

export const isAiAnalysis = (value: unknown): value is AiAnalysis => {
  if (!isObjectRecord(value)) {
    return false;
  }

  const classification = value.classification;
  const duplicateDetection = value.duplicateDetection;
  const sentiment = value.sentiment;

  if (!isObjectRecord(classification) || !isObjectRecord(duplicateDetection) || !isObjectRecord(sentiment)) {
    return false;
  }

  const isValidClassification =
    isAiIssueKind(classification.type) &&
    isConfidence(classification.confidence) &&
    typeof classification.reasoning === 'string';

  const isValidDuplicateDetection =
    typeof duplicateDetection.isDuplicate === 'boolean' &&
    (duplicateDetection.originalIssueNumber === null ||
      typeof duplicateDetection.originalIssueNumber === 'number') &&
    isConfidence(duplicateDetection.similarityScore) &&
    (duplicateDetection.hasExplicitOriginalIssueReference === undefined ||
      typeof duplicateDetection.hasExplicitOriginalIssueReference === 'boolean');

  const isValidSentiment =
    isAiTone(sentiment.tone) &&
    isConfidence(sentiment.confidence) &&
    typeof sentiment.reasoning === 'string';
  const isValidSuggestedResponse =
    value.suggestedResponse === undefined ||
    value.suggestedResponse === null ||
    typeof value.suggestedResponse === 'string';
  const isValidLabelRecommendations =
    value.labelRecommendations === undefined ||
    value.labelRecommendations === null ||
    isAiLabelRecommendations(value.labelRecommendations);

  return (
    isValidClassification &&
    isValidDuplicateDetection &&
    isValidSentiment &&
    isValidSuggestedResponse &&
    isValidLabelRecommendations
  );
};
