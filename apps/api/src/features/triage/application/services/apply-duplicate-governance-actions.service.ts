import {
  AI_TRIAGE_DUPLICATE_LABEL,
} from '../constants/ai-triage.constants';
import { type IssueAiTriageDuplicatePlan } from '../../domain/services/issue-ai-triage-action-plan.service';
import type { AiTriageGovernanceActionsExecutionContext } from './ai-triage-governance-actions-context.service';

const DUPLICATE_ACTION_PLAN_REQUIRED_ERROR = 'Duplicate action plan is required.';

export const applyDuplicateGovernanceActions = async (
  context: AiTriageGovernanceActionsExecutionContext,
  precomputedPlan: IssueAiTriageDuplicatePlan,
): Promise<void> => {
  if (!precomputedPlan) {
    throw new Error(DUPLICATE_ACTION_PLAN_REQUIRED_ERROR);
  }

  const duplicateExecutionDecision = precomputedPlan.execution;
  if (!duplicateExecutionDecision.shouldApplyDuplicateLabel) {
    if (duplicateExecutionDecision.skipReason !== 'decision_not_actionable') {
      return;
    }

    const duplicateDecision = precomputedPlan.decision;
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

  const wasDuplicateLabelAdded = await context.addLabelIfMissing(AI_TRIAGE_DUPLICATE_LABEL);

  if (!wasDuplicateLabelAdded) {
    return;
  }

  await context.governanceGateway.createComment({
    repositoryFullName: context.repositoryFullName,
    issueNumber: context.issue.number,
    body: duplicateExecutionDecision.commentBody,
  });
  context.incrementActionsAppliedCount();
  const duplicateCommentPublicationPlan = precomputedPlan.commentPublicationPlan;
  context.logger?.debug?.('AnalyzeIssueWithAiUseCase duplicate comment created.', {
    repositoryFullName: context.repositoryFullName,
    issueNumber: context.issue.number,
    originalIssueNumber: duplicateCommentPublicationPlan?.originalIssueNumber,
    similarityScore: context.aiAnalysis.duplicateDetection.similarityScore,
    usedFallbackOriginalIssue: duplicateCommentPublicationPlan?.usedFallbackOriginalIssue === true,
  });
};
