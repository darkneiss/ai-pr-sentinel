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

export interface PlanIssueDuplicateCommentPublicationInput {
  decision: IssueDuplicateActionsDecision;
  commentPrefix: string;
  similarityScore: number;
}

export interface IssueDuplicateCommentPublicationPlan {
  originalIssueNumber: number;
  usedFallbackOriginalIssue: boolean;
  commentBody: string;
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

export const planIssueDuplicateCommentPublication = ({
  decision,
  commentPrefix,
  similarityScore,
}: PlanIssueDuplicateCommentPublicationInput): IssueDuplicateCommentPublicationPlan | null => {
  if (!decision.shouldApplyDuplicateActions || decision.resolvedOriginalIssueNumber === null) {
    return null;
  }

  return {
    originalIssueNumber: decision.resolvedOriginalIssueNumber,
    usedFallbackOriginalIssue: decision.usedFallbackOriginalIssue,
    commentBody: buildIssueDuplicateComment({
      commentPrefix,
      originalIssueNumber: decision.resolvedOriginalIssueNumber,
      similarityScore,
    }),
  };
};

export const shouldProcessIssueDuplicateSignal = ({
  isDuplicate,
}: ShouldProcessIssueDuplicateSignalInput): boolean => isDuplicate;
