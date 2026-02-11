import {
  AI_CLASSIFICATION_CONFIDENCE_THRESHOLD,
  AI_QUESTION_AI_REPLY_COMMENT_PREFIX,
  AI_QUESTION_FALLBACK_CHECKLIST,
  AI_QUESTION_FALLBACK_REPLY_COMMENT_PREFIX,
  AI_QUESTION_REPLY_COMMENT_PREFIX,
  AI_QUESTION_SIGNAL_KEYWORDS,
} from '../constants/ai-triage.constants';
import type { AiTriageGovernanceActionsExecutionContext } from './ai-triage-governance-actions-context.service';
import type { QuestionResponseSource } from '../../../../shared/application/ports/question-response-metrics.port';
import {
  buildIssueQuestionFallbackResponseWhenApplicable,
  buildIssueQuestionResponseComment,
  decideIssueQuestionResponseAction,
  detectRepositoryContextUsageInResponse,
  isLikelyQuestionIssueContent,
  normalizeIssueQuestionSuggestedResponse,
  resolveIssueQuestionResponseCommentPrefix,
  shouldPrepareIssueQuestionResponseComment,
  shouldPublishIssueQuestionResponseComment,
} from '../../domain/services/issue-question-response-policy.service';

export const applyQuestionResponseGovernanceActions = async (
  context: AiTriageGovernanceActionsExecutionContext,
): Promise<void> => {
  const normalizedSuggestedResponse = normalizeIssueQuestionSuggestedResponse(context.aiAnalysis.suggestedResponse);
  const looksLikeQuestionIssue = isLikelyQuestionIssueContent({
    title: context.issue.title,
    body: context.issue.body,
    questionSignalKeywords: AI_QUESTION_SIGNAL_KEYWORDS,
  });
  const fallbackQuestionResponse = buildIssueQuestionFallbackResponseWhenApplicable({
    looksLikeQuestionIssue,
    checklistLines: AI_QUESTION_FALLBACK_CHECKLIST,
  });
  const questionResponseDecision = decideIssueQuestionResponseAction({
    action: context.action,
    effectiveTone: context.effectiveTone,
    classificationType: context.aiAnalysis.classification.type,
    classificationConfidence: context.aiAnalysis.classification.confidence,
    classificationConfidenceThreshold: AI_CLASSIFICATION_CONFIDENCE_THRESHOLD,
    looksLikeQuestionIssue,
    normalizedSuggestedResponse,
    fallbackQuestionResponse,
  });

  if (!shouldPrepareIssueQuestionResponseComment(questionResponseDecision)) {
    return;
  }

  const responseSource: QuestionResponseSource = questionResponseDecision.responseSource;
  const questionReplyCommentPrefix = resolveIssueQuestionResponseCommentPrefix({
    responseSource,
    aiSuggestedResponseCommentPrefix: AI_QUESTION_AI_REPLY_COMMENT_PREFIX,
    fallbackChecklistCommentPrefix: AI_QUESTION_FALLBACK_REPLY_COMMENT_PREFIX,
  });
  const usedRepositoryContext = detectRepositoryContextUsageInResponse({
    suggestedResponse: questionResponseDecision.responseBody,
    repositoryReadme: context.repositoryReadme,
  });
  context.questionResponseMetrics?.increment(responseSource);
  const responseSourceMetricsSnapshot = context.questionResponseMetrics?.snapshot();
  context.logger?.info?.('AnalyzeIssueWithAiUseCase question response source selected.', {
    repositoryFullName: context.repositoryFullName,
    issueNumber: context.issue.number,
    responseSource,
    usedRepositoryContext,
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
      commentPrefix: questionReplyCommentPrefix,
      responseBody: questionResponseDecision.responseBody,
    }),
  });
  context.incrementActionsAppliedCount();
  context.logger?.debug?.('AnalyzeIssueWithAiUseCase question reply comment created.', {
    repositoryFullName: context.repositoryFullName,
    issueNumber: context.issue.number,
    bodyPrefix: questionReplyCommentPrefix,
    responseSource,
  });
};
