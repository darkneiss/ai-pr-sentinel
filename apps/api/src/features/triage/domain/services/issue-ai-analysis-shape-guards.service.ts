import {
  type AiAnalysis,
  isAiIssueKind,
  isAiTone,
  isConfidence,
  isObjectRecord,
} from './issue-ai-analysis.types';

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

  return isValidClassification && isValidDuplicateDetection && isValidSentiment && isValidSuggestedResponse;
};
