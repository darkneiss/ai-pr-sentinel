import {
  AI_CLASSIFICATION_CONFIDENCE_THRESHOLD,
  AI_QUESTION_AI_REPLY_COMMENT_PREFIX,
  AI_QUESTION_FALLBACK_REPLY_COMMENT_PREFIX,
  AI_QUESTION_REPLY_COMMENT_PREFIX,
  AI_QUESTION_SIGNAL_KEYWORDS,
} from '../constants/ai-triage.constants';
import type { AiTriageGovernanceActionsExecutionContext } from './ai-triage-governance-actions-context.service';
import {
  buildFallbackQuestionResponse,
  detectRepositoryContextUsage,
} from './question-response.service';
import type { QuestionResponseSource } from '../../../../shared/application/ports/question-response-metrics.port';
import {
  decideIssueQuestionResponseAction,
  isLikelyQuestionIssueContent,
} from '../../domain/services/issue-question-response-policy.service';

export const applyQuestionResponseGovernanceActions = async (
  context: AiTriageGovernanceActionsExecutionContext,
): Promise<void> => {
  const normalizedSuggestedResponse =
    typeof context.aiAnalysis.suggestedResponse === 'string' ? context.aiAnalysis.suggestedResponse.trim() : '';
  const looksLikeQuestionIssue = isLikelyQuestionIssueContent({
    title: context.issue.title,
    body: context.issue.body,
    questionSignalKeywords: AI_QUESTION_SIGNAL_KEYWORDS,
  });
  const fallbackQuestionResponse = looksLikeQuestionIssue ? buildFallbackQuestionResponse() : '';
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

  if (!questionResponseDecision.shouldCreateComment || questionResponseDecision.responseSource === null) {
    return;
  }

  const responseSource: QuestionResponseSource = questionResponseDecision.responseSource;
  const questionReplyCommentPrefix =
    responseSource === 'ai_suggested_response'
      ? AI_QUESTION_AI_REPLY_COMMENT_PREFIX
      : AI_QUESTION_FALLBACK_REPLY_COMMENT_PREFIX;
  const usedRepositoryContext = detectRepositoryContextUsage(questionResponseDecision.responseBody, context.repositoryReadme);
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

  if (hasExistingQuestionReplyComment) {
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
    body: `${questionReplyCommentPrefix}\n\n${questionResponseDecision.responseBody}`,
  });
  context.incrementActionsAppliedCount();
  context.logger?.debug?.('AnalyzeIssueWithAiUseCase question reply comment created.', {
    repositoryFullName: context.repositoryFullName,
    issueNumber: context.issue.number,
    bodyPrefix: questionReplyCommentPrefix,
    responseSource,
  });
};
