import {
  type AiAnalysis,
  isConfidence,
  isObjectRecord,
  normalizeAiIssueKind,
  normalizeAiTone,
} from './issue-ai-analysis.types';
import {
  parseFirstValidDuplicateIssueReference,
  parseIssueNumberFromReference,
} from './issue-reference-parser-policy.service';
import { normalizeIssueQuestionSuggestedResponseValue } from './issue-question-response-policy.service';

export const normalizeStructuredAiAnalysis = (
  value: Record<string, unknown>,
  currentIssueNumber: number,
): AiAnalysis | undefined => {
  const classificationRaw = isObjectRecord(value.classification) ? value.classification : undefined;
  const duplicateDetectionRaw = isObjectRecord(value.duplicateDetection)
    ? value.duplicateDetection
    : isObjectRecord(value.duplicate)
      ? value.duplicate
      : undefined;
  const sentimentRaw = isObjectRecord(value.sentiment)
    ? value.sentiment
    : isObjectRecord(value.tone)
      ? value.tone
      : undefined;
  const rootLevelIsDuplicate =
    typeof value.duplicate === 'boolean'
      ? value.duplicate
      : typeof value.isDuplicate === 'boolean'
        ? value.isDuplicate
        : undefined;
  const hasDuplicateSignals =
    !!duplicateDetectionRaw ||
    rootLevelIsDuplicate !== undefined ||
    value.similarityScore !== undefined ||
    (classificationRaw && classificationRaw.similarityScore !== undefined) ||
    value.originalIssueNumber !== undefined ||
    value.duplicateIssueId !== undefined ||
    value.original_issue_number !== undefined ||
    value.duplicate_of !== undefined;

  if (!classificationRaw || !sentimentRaw || !hasDuplicateSignals) {
    return undefined;
  }

  const normalizedClassificationType = normalizeAiIssueKind(classificationRaw.type);
  const normalizedClassificationConfidence = isConfidence(classificationRaw.confidence)
    ? classificationRaw.confidence
    : isConfidence(value.confidence)
      ? value.confidence
      : normalizedClassificationType
        ? 1
        : 0;
  const normalizedOriginalIssueNumber =
    parseIssueNumberFromReference(duplicateDetectionRaw?.originalIssueNumber) ??
    parseIssueNumberFromReference(duplicateDetectionRaw?.duplicateIssueId) ??
    parseIssueNumberFromReference(duplicateDetectionRaw?.similarIssueId) ??
    parseIssueNumberFromReference(duplicateDetectionRaw?.original_issue_number) ??
    parseFirstValidDuplicateIssueReference({
      duplicateOf: duplicateDetectionRaw?.duplicate_of,
      currentIssueNumber,
    }) ??
    parseIssueNumberFromReference(value.originalIssueNumber) ??
    parseIssueNumberFromReference(value.duplicateIssueId) ??
    parseIssueNumberFromReference(value.similarIssueId) ??
    parseIssueNumberFromReference(value.original_issue_number) ??
    parseFirstValidDuplicateIssueReference({
      duplicateOf: value.duplicate_of,
      currentIssueNumber,
    });
  const hasExplicitOriginalIssueReference =
    duplicateDetectionRaw?.originalIssueNumber !== undefined ||
    duplicateDetectionRaw?.duplicateIssueId !== undefined ||
    duplicateDetectionRaw?.similarIssueId !== undefined ||
    duplicateDetectionRaw?.original_issue_number !== undefined ||
    duplicateDetectionRaw?.duplicate_of !== undefined ||
    value.originalIssueNumber !== undefined ||
    value.duplicateIssueId !== undefined ||
    value.similarIssueId !== undefined ||
    value.original_issue_number !== undefined ||
    value.duplicate_of !== undefined;
  const isDuplicate = duplicateDetectionRaw?.isDuplicate === true || rootLevelIsDuplicate === true;
  const normalizedSimilarityScore = isConfidence(duplicateDetectionRaw?.similarityScore)
    ? duplicateDetectionRaw.similarityScore
    : isConfidence(value.similarityScore)
      ? value.similarityScore
      : isConfidence(classificationRaw.similarityScore)
        ? classificationRaw.similarityScore
        : isDuplicate
          ? 1
          : 0;
  const normalizedTone = normalizeAiTone(sentimentRaw.tone) ?? normalizeAiTone(sentimentRaw.sentiment) ?? 'neutral';
  const normalizedSentimentConfidence = isConfidence(sentimentRaw.confidence)
    ? sentimentRaw.confidence
    : 0.5;

  return {
    classification: {
      type: normalizedClassificationType ?? 'bug',
      confidence: normalizedClassificationConfidence,
      reasoning:
        typeof classificationRaw.reasoning === 'string'
          ? classificationRaw.reasoning
          : 'Structured-format AI response',
    },
    duplicateDetection: {
      isDuplicate,
      originalIssueNumber: normalizedOriginalIssueNumber,
      similarityScore: normalizedSimilarityScore,
      hasExplicitOriginalIssueReference,
    },
    sentiment: {
      tone: normalizedTone,
      confidence: normalizedSentimentConfidence,
      reasoning:
        typeof sentimentRaw.reasoning === 'string' ? sentimentRaw.reasoning : 'Structured-format AI response',
    },
    suggestedResponse:
      normalizeIssueQuestionSuggestedResponseValue(value.suggestedResponse) ??
      normalizeIssueQuestionSuggestedResponseValue(value.suggested_response),
  };
};
