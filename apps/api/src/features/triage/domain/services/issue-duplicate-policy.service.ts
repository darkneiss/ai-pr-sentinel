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

export interface DecideIssueDuplicateGovernanceExecutionInput {
  shouldProcessSignal: boolean;
  decision: IssueDuplicateActionsDecision;
  commentPublicationPlan: IssueDuplicateCommentPublicationPlan | null;
}

export type IssueDuplicateGovernanceExecutionSkipReason =
  | 'signal_not_marked_duplicate'
  | 'decision_not_actionable'
  | 'missing_comment_publication_plan';

export type IssueDuplicateGovernanceExecutionDecision =
  | {
      shouldApplyDuplicateLabel: false;
      commentBody: null;
      skipReason: IssueDuplicateGovernanceExecutionSkipReason;
    }
  | {
      shouldApplyDuplicateLabel: true;
      commentBody: string;
      skipReason: null;
    };

export interface DecideIssueDuplicateCommentExecutionInput {
  execution: IssueDuplicateGovernanceExecutionDecision;
  wasDuplicateLabelAdded: boolean;
}

export type IssueDuplicateCommentExecutionSkipReason =
  | 'execution_not_actionable'
  | 'duplicate_label_already_present';

export type IssueDuplicateCommentExecutionDecision =
  | {
      shouldCreateComment: false;
      commentBody: null;
      skipReason: IssueDuplicateCommentExecutionSkipReason;
    }
  | {
      shouldCreateComment: true;
      commentBody: string;
      skipReason: null;
    };

export interface DecideIssueDuplicateSkippedLogDecisionInput {
  execution: IssueDuplicateGovernanceExecutionDecision;
}

export type IssueDuplicateSkippedLogDecision =
  | {
      shouldLogSkippedDuplicate: true;
      skipReason: null;
    }
  | {
      shouldLogSkippedDuplicate: false;
      skipReason: 'skip_reason_not_loggable';
    };

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

export const decideIssueDuplicateGovernanceExecution = ({
  shouldProcessSignal,
  decision,
  commentPublicationPlan,
}: DecideIssueDuplicateGovernanceExecutionInput): IssueDuplicateGovernanceExecutionDecision => {
  if (!shouldProcessSignal) {
    return {
      shouldApplyDuplicateLabel: false,
      commentBody: null,
      skipReason: 'signal_not_marked_duplicate',
    };
  }

  if (!decision.shouldApplyDuplicateActions) {
    return {
      shouldApplyDuplicateLabel: false,
      commentBody: null,
      skipReason: 'decision_not_actionable',
    };
  }

  if (!commentPublicationPlan) {
    return {
      shouldApplyDuplicateLabel: false,
      commentBody: null,
      skipReason: 'missing_comment_publication_plan',
    };
  }

  return {
    shouldApplyDuplicateLabel: true,
    commentBody: commentPublicationPlan.commentBody,
    skipReason: null,
  };
};

export const decideIssueDuplicateCommentExecution = ({
  execution,
  wasDuplicateLabelAdded,
}: DecideIssueDuplicateCommentExecutionInput): IssueDuplicateCommentExecutionDecision => {
  if (!execution.shouldApplyDuplicateLabel) {
    return {
      shouldCreateComment: false,
      commentBody: null,
      skipReason: 'execution_not_actionable',
    };
  }

  if (!wasDuplicateLabelAdded) {
    return {
      shouldCreateComment: false,
      commentBody: null,
      skipReason: 'duplicate_label_already_present',
    };
  }

  return {
    shouldCreateComment: true,
    commentBody: execution.commentBody,
    skipReason: null,
  };
};

export const decideIssueDuplicateSkippedLogDecision = ({
  execution,
}: DecideIssueDuplicateSkippedLogDecisionInput): IssueDuplicateSkippedLogDecision => {
  if (!execution.shouldApplyDuplicateLabel && execution.skipReason === 'decision_not_actionable') {
    return {
      shouldLogSkippedDuplicate: true,
      skipReason: null,
    };
  }

  return {
    shouldLogSkippedDuplicate: false,
    skipReason: 'skip_reason_not_loggable',
  };
};
