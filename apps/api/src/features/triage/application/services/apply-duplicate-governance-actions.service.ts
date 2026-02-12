import {
  AI_TRIAGE_DUPLICATE_LABEL,
} from '../constants/ai-triage.constants';
import {
  type IssueDuplicateActionsDecision,
  type IssueDuplicateCommentPublicationPlan,
} from '../../domain/services/issue-duplicate-policy.service';
import type { AiTriageGovernanceActionsExecutionContext } from './ai-triage-governance-actions-context.service';

const DUPLICATE_ACTION_PLAN_REQUIRED_ERROR = 'Duplicate action plan is required.';

export interface DuplicateGovernanceExecutionPlan {
  shouldProcessSignal: boolean;
  duplicateDecision: IssueDuplicateActionsDecision;
  duplicateCommentPublicationPlan: IssueDuplicateCommentPublicationPlan | null;
}

export const applyDuplicateGovernanceActions = async (
  context: AiTriageGovernanceActionsExecutionContext,
  precomputedPlan: DuplicateGovernanceExecutionPlan,
): Promise<void> => {
  if (!precomputedPlan) {
    throw new Error(DUPLICATE_ACTION_PLAN_REQUIRED_ERROR);
  }

  const shouldProcessSignal = precomputedPlan.shouldProcessSignal;
  if (!shouldProcessSignal) {
    return;
  }

  const duplicateDecision = precomputedPlan.duplicateDecision;

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

  const duplicateCommentPublicationPlan = precomputedPlan.duplicateCommentPublicationPlan;
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
