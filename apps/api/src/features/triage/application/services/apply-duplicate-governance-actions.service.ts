import { AI_DUPLICATE_SIMILARITY_THRESHOLD, AI_TRIAGE_DUPLICATE_LABEL } from '../constants/ai-triage.constants';
import { decideIssueDuplicateActions } from '../../domain/services/issue-duplicate-policy.service';
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

  const duplicateDecision = decideIssueDuplicateActions({
    isDuplicate: context.aiAnalysis.duplicateDetection.isDuplicate,
    originalIssueNumber: context.aiAnalysis.duplicateDetection.originalIssueNumber,
    similarityScore: context.aiAnalysis.duplicateDetection.similarityScore,
    hasExplicitOriginalIssueReference: context.aiAnalysis.duplicateDetection.hasExplicitOriginalIssueReference === true,
    currentIssueNumber: context.issue.number,
    fallbackOriginalIssueNumber: resolveFallbackOriginalIssueNumber(context),
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

  const resolvedOriginalIssueNumber = duplicateDecision.resolvedOriginalIssueNumber;
  if (resolvedOriginalIssueNumber === null) {
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
    usedFallbackOriginalIssue: duplicateDecision.usedFallbackOriginalIssue,
  });
};
