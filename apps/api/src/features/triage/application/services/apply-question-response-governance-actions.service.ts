import {
  AI_QUESTION_REPLY_COMMENT_PREFIX,
} from '../constants/ai-triage.constants';
import type { AiTriageGovernanceActionsExecutionContext } from './ai-triage-governance-actions-context.service';
import type { QuestionResponseSource } from '../../../../shared/application/ports/question-response-metrics.port';
import {
  decideIssueQuestionResponseCommentPublication,
} from '../../domain/services/issue-question-response-policy.service';
import { type IssueAiTriageQuestionPlan } from '../../domain/services/issue-ai-triage-action-plan.service';

const QUESTION_RESPONSE_ACTION_PLAN_REQUIRED_ERROR = 'Question response action plan is required.';

export const applyQuestionResponseGovernanceActions = async (
  context: AiTriageGovernanceActionsExecutionContext,
  precomputedPlan: IssueAiTriageQuestionPlan,
): Promise<void> => {
  if (!precomputedPlan) {
    throw new Error(QUESTION_RESPONSE_ACTION_PLAN_REQUIRED_ERROR);
  }

  const publicationPreparationDecision = precomputedPlan.publicationPreparation;
  if (!publicationPreparationDecision.shouldCheckExistingQuestionReplyComment) {
    context.logger?.debug?.('AnalyzeIssueWithAiUseCase question reply comment not published.', {
      repositoryFullName: context.repositoryFullName,
      issueNumber: context.issue.number,
      bodyPrefix: AI_QUESTION_REPLY_COMMENT_PREFIX,
      authorLogin: context.botLogin,
      skipReason: publicationPreparationDecision.skipReason,
    });
    return;
  }

  const publicationPlan = publicationPreparationDecision.publicationPlan;
  const responseSource: QuestionResponseSource = publicationPreparationDecision.responseSource;
  context.questionResponseMetrics?.increment(responseSource);
  const responseSourceMetricsSnapshot = context.questionResponseMetrics?.snapshot();
  context.logger?.info?.('AnalyzeIssueWithAiUseCase question response source selected.', {
    repositoryFullName: context.repositoryFullName,
    issueNumber: context.issue.number,
    responseSource,
    usedRepositoryContext: publicationPreparationDecision.usedRepositoryContext,
    metrics: responseSourceMetricsSnapshot,
  });
  const hasExistingQuestionReplyComment = await context.issueHistoryGateway.hasIssueCommentWithPrefix({
    repositoryFullName: context.repositoryFullName,
    issueNumber: context.issue.number,
    bodyPrefix: AI_QUESTION_REPLY_COMMENT_PREFIX,
    authorLogin: context.botLogin,
  });

  const publicationDecision = decideIssueQuestionResponseCommentPublication({
    publicationPlan,
    hasExistingQuestionReplyComment,
  });

  if (!publicationDecision.shouldCreateComment) {
    context.logger?.debug?.('AnalyzeIssueWithAiUseCase question reply comment not published.', {
      repositoryFullName: context.repositoryFullName,
      issueNumber: context.issue.number,
      bodyPrefix: AI_QUESTION_REPLY_COMMENT_PREFIX,
      authorLogin: context.botLogin,
      skipReason: publicationDecision.skipReason,
    });
    return;
  }

  await context.governanceGateway.createComment({
    repositoryFullName: context.repositoryFullName,
    issueNumber: context.issue.number,
    body: publicationDecision.commentBody,
  });
  context.incrementActionsAppliedCount();
  context.logger?.debug?.('AnalyzeIssueWithAiUseCase question reply comment created.', {
      repositoryFullName: context.repositoryFullName,
      issueNumber: context.issue.number,
      bodyPrefix: publicationPlan.commentPrefix,
      responseSource,
    });
};
