export interface DecideIssueDuplicateActionsInput {
  isDuplicate: boolean;
  originalIssueNumber: number | null;
  similarityScore: number;
  hasExplicitOriginalIssueReference: boolean;
  currentIssueNumber: number;
  fallbackOriginalIssueNumber: number | null;
  similarityThreshold: number;
}

export interface IssueDuplicateActionsDecision {
  shouldApplyDuplicateActions: boolean;
  resolvedOriginalIssueNumber: number | null;
  hasSimilarityScore: boolean;
  hasValidOriginalIssue: boolean;
  usedFallbackOriginalIssue: boolean;
}

export const decideIssueDuplicateActions = ({
  isDuplicate,
  originalIssueNumber,
  similarityScore,
  hasExplicitOriginalIssueReference,
  currentIssueNumber,
  fallbackOriginalIssueNumber,
  similarityThreshold,
}: DecideIssueDuplicateActionsInput): IssueDuplicateActionsDecision => {
  const hasSimilarityScore = similarityScore >= similarityThreshold;
  const shouldApplyFallbackOriginalIssue = originalIssueNumber === null && hasSimilarityScore;
  const shouldApplyFallbackWithoutReference = shouldApplyFallbackOriginalIssue && !hasExplicitOriginalIssueReference;
  const resolvedOriginalIssueNumber = shouldApplyFallbackWithoutReference ? fallbackOriginalIssueNumber : originalIssueNumber;
  const hasValidOriginalIssue = resolvedOriginalIssueNumber !== null && resolvedOriginalIssueNumber !== currentIssueNumber;
  const shouldApplyDuplicateActions = isDuplicate && hasSimilarityScore && hasValidOriginalIssue;
  const usedFallbackOriginalIssue = shouldApplyFallbackWithoutReference && resolvedOriginalIssueNumber !== null;

  return {
    shouldApplyDuplicateActions,
    resolvedOriginalIssueNumber,
    hasSimilarityScore,
    hasValidOriginalIssue,
    usedFallbackOriginalIssue,
  };
};
