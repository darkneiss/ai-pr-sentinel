import {
  AI_DUPLICATE_COMMENT_PREFIX,
  AI_DUPLICATE_SIMILARITY_THRESHOLD,
  AI_TRIAGE_DUPLICATE_LABEL,
} from '../constants/ai-triage.constants';
import {
  decideIssueDuplicateActions,
  planIssueDuplicateCommentPublication,
  resolveFallbackDuplicateIssueNumber,
  shouldProcessIssueDuplicateSignal,
} from '../../domain/services/issue-duplicate-policy.service';
import type { AiTriageGovernanceActionsExecutionContext } from './ai-triage-governance-actions-context.service';

export const applyDuplicateGovernanceActions = async (
  context: AiTriageGovernanceActionsExecutionContext,
): Promise<void> => {
  if (!shouldProcessIssueDuplicateSignal({ isDuplicate: context.aiAnalysis.duplicateDetection.isDuplicate })) {
    return;
  }

  const duplicateDecision = decideIssueDuplicateActions({
    isDuplicate: context.aiAnalysis.duplicateDetection.isDuplicate,
    originalIssueNumber: context.aiAnalysis.duplicateDetection.originalIssueNumber,
    similarityScore: context.aiAnalysis.duplicateDetection.similarityScore,
    hasExplicitOriginalIssueReference: context.aiAnalysis.duplicateDetection.hasExplicitOriginalIssueReference === true,
    currentIssueNumber: context.issue.number,
    fallbackOriginalIssueNumber: resolveFallbackDuplicateIssueNumber({
      currentIssueNumber: context.issue.number,
      recentIssueNumbers: context.recentIssues.map((issue) => issue.number),
    }),
    similarityThreshold: AI_DUPLICATE_SIMILARITY_THRESHOLD,
  });

  if (!duplicateDecision.shouldApplyDuplicateActions) {
    context.logger?.info?.('AnalyzeIssueWithAiUseCase duplicate detection skipped.', {
      repositoryFullName: context.repositoryFullName,
      issueNumber: context.issue.number,
      originalIssueNumber: duplicateDecision.resolvedOriginalIssueNumber,
      similarityScore: context.aiAnalysis.duplicateDetection.similarityScore,
      hasValidOriginalIssue: duplicateDecision.hasValidOriginalIssue,
      hasSimilarityScore: duplicateDecision.hasSimilarityScore,
      usedFallbackOriginalIssue: duplicateDecision.usedFallbackOriginalIssue,
    });
    return;
  }

  const duplicateCommentPublicationPlan = planIssueDuplicateCommentPublication({
    decision: duplicateDecision,
    commentPrefix: AI_DUPLICATE_COMMENT_PREFIX,
    similarityScore: context.aiAnalysis.duplicateDetection.similarityScore,
  });
  if (!duplicateCommentPublicationPlan) {
    return;
  }

  const wasDuplicateLabelAdded = await context.addLabelIfMissing(AI_TRIAGE_DUPLICATE_LABEL);

  if (!wasDuplicateLabelAdded) {
    return;
  }

  await context.governanceGateway.createComment({
    repositoryFullName: context.repositoryFullName,
    issueNumber: context.issue.number,
    body: duplicateCommentPublicationPlan.commentBody,
  });
  context.incrementActionsAppliedCount();
  context.logger?.debug?.('AnalyzeIssueWithAiUseCase duplicate comment created.', {
    repositoryFullName: context.repositoryFullName,
    issueNumber: context.issue.number,
    originalIssueNumber: duplicateCommentPublicationPlan.originalIssueNumber,
    similarityScore: context.aiAnalysis.duplicateDetection.similarityScore,
    usedFallbackOriginalIssue: duplicateCommentPublicationPlan.usedFallbackOriginalIssue,
  });
};
