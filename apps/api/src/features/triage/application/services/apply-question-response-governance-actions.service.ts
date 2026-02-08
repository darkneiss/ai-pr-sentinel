import {
  AI_CLASSIFICATION_CONFIDENCE_THRESHOLD,
  AI_QUESTION_AI_REPLY_COMMENT_PREFIX,
  AI_QUESTION_FALLBACK_REPLY_COMMENT_PREFIX,
  AI_QUESTION_REPLY_COMMENT_PREFIX,
} from '../constants/ai-triage.constants';
import type { AiTriageGovernanceActionsExecutionContext } from './ai-triage-governance-actions-context.service';
import {
  buildFallbackQuestionResponse,
  detectRepositoryContextUsage,
  isLikelyQuestionIssue,
} from './question-response.service';
import type { QuestionResponseSource } from '../../../../shared/application/ports/question-response-metrics.port';

export const applyQuestionResponseGovernanceActions = async (
  context: AiTriageGovernanceActionsExecutionContext,
): Promise<void> => {
  const normalizedSuggestedResponse =
    typeof context.aiAnalysis.suggestedResponse === 'string' ? context.aiAnalysis.suggestedResponse.trim() : '';
  const hasHighConfidenceQuestionClassification =
    context.aiAnalysis.classification.type === 'question' &&
    context.aiAnalysis.classification.confidence >= AI_CLASSIFICATION_CONFIDENCE_THRESHOLD;
  const looksLikeQuestionIssue = isLikelyQuestionIssue(context.issue.title, context.issue.body);
  const fallbackQuestionResponse = looksLikeQuestionIssue ? buildFallbackQuestionResponse() : '';
  const effectiveQuestionResponse = normalizedSuggestedResponse || fallbackQuestionResponse;
  const isHostileTone = context.effectiveTone === 'hostile';
  const shouldCreateQuestionResponseComment =
    context.action === 'opened' &&
    !isHostileTone &&
    (hasHighConfidenceQuestionClassification || looksLikeQuestionIssue) &&
    effectiveQuestionResponse.length > 0;

  if (!shouldCreateQuestionResponseComment) {
    return;
  }

  const responseSource: QuestionResponseSource =
    normalizedSuggestedResponse.length > 0 ? 'ai_suggested_response' : 'fallback_checklist';
  const questionReplyCommentPrefix =
    responseSource === 'ai_suggested_response'
      ? AI_QUESTION_AI_REPLY_COMMENT_PREFIX
      : AI_QUESTION_FALLBACK_REPLY_COMMENT_PREFIX;
  const usedRepositoryContext = detectRepositoryContextUsage(effectiveQuestionResponse, context.repositoryReadme);
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
    body: `${questionReplyCommentPrefix}\n\n${effectiveQuestionResponse}`,
  });
  context.incrementActionsAppliedCount();
  context.logger?.debug?.('AnalyzeIssueWithAiUseCase question reply comment created.', {
    repositoryFullName: context.repositoryFullName,
    issueNumber: context.issue.number,
    bodyPrefix: questionReplyCommentPrefix,
    responseSource,
  });
};
