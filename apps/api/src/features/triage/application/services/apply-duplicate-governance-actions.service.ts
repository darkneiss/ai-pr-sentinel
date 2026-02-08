import { AI_DUPLICATE_SIMILARITY_THRESHOLD, AI_TRIAGE_DUPLICATE_LABEL } from '../constants/ai-triage.constants';
import { isValidOriginalIssueNumber } from './ai-analysis-normalizer.service';
import type { AiTriageGovernanceActionsExecutionContext } from './ai-triage-governance-actions-context.service';
import { buildDuplicateComment } from './issue-triage-labels.service';

export const applyDuplicateGovernanceActions = async (
  context: AiTriageGovernanceActionsExecutionContext,
): Promise<void> => {
  if (!context.aiAnalysis.duplicateDetection.isDuplicate) {
    return;
  }

  const originalIssueNumber = context.aiAnalysis.duplicateDetection.originalIssueNumber;
  const hasValidOriginalIssue = isValidOriginalIssueNumber(originalIssueNumber, context.issue.number);
  const hasSimilarityScore =
    context.aiAnalysis.duplicateDetection.similarityScore >= AI_DUPLICATE_SIMILARITY_THRESHOLD;

  if (!hasValidOriginalIssue || !hasSimilarityScore) {
    context.logger?.info?.('AnalyzeIssueWithAiUseCase duplicate detection skipped.', {
      repositoryFullName: context.repositoryFullName,
      issueNumber: context.issue.number,
      originalIssueNumber: context.aiAnalysis.duplicateDetection.originalIssueNumber,
      similarityScore: context.aiAnalysis.duplicateDetection.similarityScore,
      hasValidOriginalIssue,
      hasSimilarityScore,
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
    body: buildDuplicateComment(originalIssueNumber, context.aiAnalysis.duplicateDetection.similarityScore),
  });
  context.incrementActionsAppliedCount();
  context.logger?.debug?.('AnalyzeIssueWithAiUseCase duplicate comment created.', {
    repositoryFullName: context.repositoryFullName,
    issueNumber: context.issue.number,
    originalIssueNumber,
    similarityScore: context.aiAnalysis.duplicateDetection.similarityScore,
  });
};
