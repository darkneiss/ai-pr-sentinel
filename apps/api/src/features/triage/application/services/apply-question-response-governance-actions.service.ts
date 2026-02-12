import {
  AI_QUESTION_REPLY_COMMENT_PREFIX,
} from '../constants/ai-triage.constants';
import type { AiTriageGovernanceActionsExecutionContext } from './ai-triage-governance-actions-context.service';
import type { QuestionResponseSource } from '../../../../shared/application/ports/question-response-metrics.port';
import {
  buildIssueQuestionResponseComment,
  shouldPublishIssueQuestionResponseComment,
  type IssueQuestionResponseCommentPublicationPlan,
} from '../../domain/services/issue-question-response-policy.service';

const QUESTION_RESPONSE_ACTION_PLAN_REQUIRED_ERROR = 'Question response action plan is required.';

export interface QuestionResponseGovernanceExecutionPlan {
  questionCommentPublicationPlan: IssueQuestionResponseCommentPublicationPlan | null;
}

export const applyQuestionResponseGovernanceActions = async (
  context: AiTriageGovernanceActionsExecutionContext,
  precomputedPlan: QuestionResponseGovernanceExecutionPlan,
): Promise<void> => {
  if (!precomputedPlan) {
    throw new Error(QUESTION_RESPONSE_ACTION_PLAN_REQUIRED_ERROR);
  }

  const publicationPlan = precomputedPlan.questionCommentPublicationPlan;

  if (!publicationPlan) {
    return;
  }

  const responseSource: QuestionResponseSource = publicationPlan.responseSource;
  context.questionResponseMetrics?.increment(responseSource);
  const responseSourceMetricsSnapshot = context.questionResponseMetrics?.snapshot();
  context.logger?.info?.('AnalyzeIssueWithAiUseCase question response source selected.', {
    repositoryFullName: context.repositoryFullName,
    issueNumber: context.issue.number,
    responseSource,
    usedRepositoryContext: publicationPlan.usedRepositoryContext,
    metrics: responseSourceMetricsSnapshot,
  });
  const hasExistingQuestionReplyComment = await context.issueHistoryGateway.hasIssueCommentWithPrefix({
    repositoryFullName: context.repositoryFullName,
    issueNumber: context.issue.number,
    bodyPrefix: AI_QUESTION_REPLY_COMMENT_PREFIX,
    authorLogin: context.botLogin,
  });

  if (!shouldPublishIssueQuestionResponseComment({ hasExistingQuestionReplyComment })) {
    context.logger?.debug?.('AnalyzeIssueWithAiUseCase question reply comment already exists. Skipping.', {
      repositoryFullName: context.repositoryFullName,
      issueNumber: context.issue.number,
      bodyPrefix: AI_QUESTION_REPLY_COMMENT_PREFIX,
      authorLogin: context.botLogin,
    });
    return;
  }

  await context.governanceGateway.createComment({
    repositoryFullName: context.repositoryFullName,
    issueNumber: context.issue.number,
    body: buildIssueQuestionResponseComment({
      commentPrefix: publicationPlan.commentPrefix,
      responseBody: publicationPlan.responseBody,
    }),
  });
  context.incrementActionsAppliedCount();
  context.logger?.debug?.('AnalyzeIssueWithAiUseCase question reply comment created.', {
      repositoryFullName: context.repositoryFullName,
      issueNumber: context.issue.number,
      bodyPrefix: publicationPlan.commentPrefix,
      responseSource,
    });
};
