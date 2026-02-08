import {
  type AiAnalysis,
  isConfidence,
  isObjectRecord,
  normalizeAiIssueKind,
  normalizeAiTone,
} from './ai-analysis.types';
import {
  parseFirstValidDuplicateIssue,
  parseIssueNumberFromReference,
} from './ai-analysis-reference-parser.service';

export const normalizeLegacyAiAnalysis = (
  value: Record<string, unknown>,
  currentIssueNumber: number,
): AiAnalysis | undefined => {
  const legacyClassification = normalizeAiIssueKind(value.classification);
  const legacyTone = normalizeAiTone(value.tone);
  const duplicateDetectionRaw = isObjectRecord(value.duplicate_detection)
    ? value.duplicate_detection
    : undefined;
  const explicitLegacyOriginalIssue =
    parseIssueNumberFromReference(duplicateDetectionRaw?.original_issue_number) ??
    parseIssueNumberFromReference(duplicateDetectionRaw?.originalIssueNumber);
  const legacyDuplicateIssueNumber = parseFirstValidDuplicateIssue(
    explicitLegacyOriginalIssue ?? duplicateDetectionRaw?.duplicate_of,
    currentIssueNumber,
  );
  const isLegacyDuplicate = duplicateDetectionRaw?.is_duplicate === true;
  const hasLegacyShape = typeof value.tone === 'string' || !!duplicateDetectionRaw;

  if (!hasLegacyShape) {
    return undefined;
  }

  return {
    classification: {
      type: legacyClassification ?? 'bug',
      confidence: legacyClassification ? 1 : 0,
      reasoning: typeof value.reasoning === 'string' ? value.reasoning : 'Legacy-format AI response',
    },
    duplicateDetection: {
      isDuplicate: isLegacyDuplicate,
      originalIssueNumber: legacyDuplicateIssueNumber,
      similarityScore: isLegacyDuplicate ? 1 : 0,
    },
    sentiment: {
      tone: legacyTone ?? 'neutral',
      confidence: isConfidence(value.confidence) ? value.confidence : 0.5,
      reasoning: 'Legacy-format AI response',
    },
    suggestedResponse:
      typeof value.suggested_response === 'string'
        ? value.suggested_response
        : typeof value.suggestedResponse === 'string'
          ? value.suggestedResponse
          : undefined,
  };
};
