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

export interface ResolveFallbackDuplicateIssueNumberInput {
  currentIssueNumber: number;
  recentIssueNumbers: readonly number[];
}

export interface BuildIssueDuplicateCommentInput {
  commentPrefix: string;
  originalIssueNumber: number;
  similarityScore: number;
}

export interface ShouldProcessIssueDuplicateSignalInput {
  isDuplicate: boolean;
}

const SIMILARITY_PERCENT_MULTIPLIER = 100;

export const resolveFallbackDuplicateIssueNumber = ({
  currentIssueNumber,
  recentIssueNumbers,
}: ResolveFallbackDuplicateIssueNumberInput): number | null =>
  recentIssueNumbers.find((issueNumber) => issueNumber !== currentIssueNumber) ?? null;

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

export const buildIssueDuplicateComment = ({
  commentPrefix,
  originalIssueNumber,
  similarityScore,
}: BuildIssueDuplicateCommentInput): string =>
  `${commentPrefix}${originalIssueNumber} (Similarity: ${Math.round(similarityScore * SIMILARITY_PERCENT_MULTIPLIER)}%).`;

export const shouldProcessIssueDuplicateSignal = ({
  isDuplicate,
}: ShouldProcessIssueDuplicateSignalInput): boolean => isDuplicate;
