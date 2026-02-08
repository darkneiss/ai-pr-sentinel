import { AI_DUPLICATE_SIMILARITY_THRESHOLD, AI_TRIAGE_DUPLICATE_LABEL } from '../constants/ai-triage.constants';
import { isValidOriginalIssueNumber } from './ai-analysis-normalizer.service';
import type { AiTriageGovernanceActionsExecutionContext } from './ai-triage-governance-actions-context.service';
import { buildDuplicateComment } from './issue-triage-labels.service';

const resolveFallbackOriginalIssueNumber = (context: AiTriageGovernanceActionsExecutionContext): number | null => {
  const recentIssue = context.recentIssues.find((issue) => issue.number !== context.issue.number);
  return recentIssue?.number ?? null;
};

export const applyDuplicateGovernanceActions = async (
  context: AiTriageGovernanceActionsExecutionContext,
): Promise<void> => {
  if (!context.aiAnalysis.duplicateDetection.isDuplicate) {
    return;
  }

  const originalIssueNumber = context.aiAnalysis.duplicateDetection.originalIssueNumber;
  const hasSimilarityScore =
    context.aiAnalysis.duplicateDetection.similarityScore >= AI_DUPLICATE_SIMILARITY_THRESHOLD;
  const hasExplicitOriginalIssueReference =
    context.aiAnalysis.duplicateDetection.hasExplicitOriginalIssueReference === true;
  const shouldApplyFallbackOriginalIssue = originalIssueNumber === null && hasSimilarityScore;
  const shouldApplyFallbackWithoutReference = shouldApplyFallbackOriginalIssue && !hasExplicitOriginalIssueReference;
  const fallbackOriginalIssueNumber = shouldApplyFallbackOriginalIssue
    ? resolveFallbackOriginalIssueNumber(context)
    : null;
  const resolvedOriginalIssueNumber = shouldApplyFallbackWithoutReference
    ? fallbackOriginalIssueNumber
    : originalIssueNumber;
  const hasValidOriginalIssue = isValidOriginalIssueNumber(resolvedOriginalIssueNumber, context.issue.number);

  if (!hasValidOriginalIssue || !hasSimilarityScore) {
    context.logger?.info?.('AnalyzeIssueWithAiUseCase duplicate detection skipped.', {
      repositoryFullName: context.repositoryFullName,
      issueNumber: context.issue.number,
      originalIssueNumber: resolvedOriginalIssueNumber,
      similarityScore: context.aiAnalysis.duplicateDetection.similarityScore,
      hasValidOriginalIssue,
      hasSimilarityScore,
      usedFallbackOriginalIssue: shouldApplyFallbackWithoutReference && resolvedOriginalIssueNumber !== null,
    });
    return;
  }

  const wasDuplicateLabelAdded = await context.addLabelIfMissing(AI_TRIAGE_DUPLICATE_LABEL);

  if (!wasDuplicateLabelAdded) {
    return;
  }

  await context.governanceGateway.createComment({
    repositoryFullName: context.repositoryFullName,
    issueNumber: context.issue.number,
    body: buildDuplicateComment(resolvedOriginalIssueNumber, context.aiAnalysis.duplicateDetection.similarityScore),
  });
  context.incrementActionsAppliedCount();
  context.logger?.debug?.('AnalyzeIssueWithAiUseCase duplicate comment created.', {
    repositoryFullName: context.repositoryFullName,
    issueNumber: context.issue.number,
    originalIssueNumber: resolvedOriginalIssueNumber,
    similarityScore: context.aiAnalysis.duplicateDetection.similarityScore,
    usedFallbackOriginalIssue: shouldApplyFallbackWithoutReference && resolvedOriginalIssueNumber !== null,
  });
};
