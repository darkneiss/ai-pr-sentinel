import {
  AI_CLASSIFICATION_CONFIDENCE_THRESHOLD,
  AI_DUPLICATE_COMMENT_PREFIX,
  AI_DUPLICATE_SIMILARITY_THRESHOLD,
  AI_KIND_BUG_LABEL,
  AI_KIND_FEATURE_LABEL,
  AI_KIND_LABELS,
  AI_KIND_QUESTION_LABEL,
  AI_QUESTION_AI_REPLY_COMMENT_PREFIX,
  AI_QUESTION_FALLBACK_CHECKLIST,
  AI_QUESTION_FALLBACK_REPLY_COMMENT_PREFIX,
  AI_QUESTION_SIGNAL_KEYWORDS,
  AI_SENTIMENT_CONFIDENCE_THRESHOLD,
  AI_TRIAGE_LOG_EVENT_COMPLETED,
  AI_TRIAGE_LOG_EVENT_FAILED,
  AI_TRIAGE_LOG_EVENT_STARTED,
  AI_TRIAGE_LOG_START_DURATION_MS,
  AI_TRIAGE_LOG_STATUS_COMPLETED,
  AI_TRIAGE_LOG_STATUS_FAILED,
  AI_TRIAGE_LOG_STATUS_STARTED,
  AI_TRIAGE_LOG_STEP_CLASSIFICATION,
  AI_TRIAGE_LOG_STEP_DUPLICATE,
  AI_TRIAGE_LOG_STEP_TONE,
  AI_TRIAGE_MONITOR_LABEL,
  type AiTriageLogStep,
} from '../constants/ai-triage.constants';
import {
  createAiTriageGovernanceActionsExecutionContext,
  type ApplyAiTriageGovernanceActionsInput,
  type ApplyAiTriageGovernanceActionsResult,
} from './ai-triage-governance-actions-context.service';
import { buildIssueAiTriageActionPlan } from '../../domain/services/issue-ai-triage-action-plan.service';
import { applyClassificationGovernanceActions } from './apply-classification-governance-actions.service';
import { applyDuplicateGovernanceActions } from './apply-duplicate-governance-actions.service';
import { applyQuestionResponseGovernanceActions } from './apply-question-response-governance-actions.service';

export const applyAiTriageGovernanceActions = async (
  input: ApplyAiTriageGovernanceActionsInput,
): Promise<ApplyAiTriageGovernanceActionsResult> => {
  const context = createAiTriageGovernanceActionsExecutionContext(input);
  const actionPlan = buildIssueAiTriageActionPlan({
    action: context.action,
    issue: {
      number: context.issue.number,
      title: context.issue.title,
      body: context.issue.body,
    },
    existingLabels: Array.from(context.issueLabels),
    aiAnalysis: context.aiAnalysis,
    recentIssueNumbers: context.recentIssues.map((issue) => issue.number),
    repositoryReadme: context.repositoryReadme,
    kindPolicy: {
      bugLabel: AI_KIND_BUG_LABEL,
      featureLabel: AI_KIND_FEATURE_LABEL,
      questionLabel: AI_KIND_QUESTION_LABEL,
      kindLabels: AI_KIND_LABELS,
      classificationConfidenceThreshold: AI_CLASSIFICATION_CONFIDENCE_THRESHOLD,
      sentimentConfidenceThreshold: AI_SENTIMENT_CONFIDENCE_THRESHOLD,
    },
    duplicatePolicy: {
      similarityThreshold: AI_DUPLICATE_SIMILARITY_THRESHOLD,
      commentPrefix: AI_DUPLICATE_COMMENT_PREFIX,
    },
    questionPolicy: {
      classificationConfidenceThreshold: AI_CLASSIFICATION_CONFIDENCE_THRESHOLD,
      questionSignalKeywords: AI_QUESTION_SIGNAL_KEYWORDS,
      fallbackChecklist: AI_QUESTION_FALLBACK_CHECKLIST,
      aiSuggestedResponseCommentPrefix: AI_QUESTION_AI_REPLY_COMMENT_PREFIX,
      fallbackChecklistCommentPrefix: AI_QUESTION_FALLBACK_REPLY_COMMENT_PREFIX,
    },
    tonePolicy: {
      monitorLabel: AI_TRIAGE_MONITOR_LABEL,
    },
  });

  const logTriageEvent = (
    eventName: string,
    step: AiTriageLogStep,
    status: string,
    durationMs: number,
    error?: unknown,
  ): void => {
    if (!context.logger?.debug) {
      return;
    }

    context.logger.debug(eventName, {
      repositoryFullName: context.repositoryFullName,
      issueNumber: context.issue.number,
      step,
      durationMs,
      status,
      provider: context.llmProvider,
      model: context.llmModel,
      ...(error ? { error } : {}),
    });
  };

  const runStep = async (step: AiTriageLogStep, action: () => Promise<void>): Promise<void> => {
    const startedAt = Date.now();
    logTriageEvent(AI_TRIAGE_LOG_EVENT_STARTED, step, AI_TRIAGE_LOG_STATUS_STARTED, AI_TRIAGE_LOG_START_DURATION_MS);

    try {
      await action();
      logTriageEvent(
        AI_TRIAGE_LOG_EVENT_COMPLETED,
        step,
        AI_TRIAGE_LOG_STATUS_COMPLETED,
        Date.now() - startedAt,
      );
    } catch (error: unknown) {
      logTriageEvent(
        AI_TRIAGE_LOG_EVENT_FAILED,
        step,
        AI_TRIAGE_LOG_STATUS_FAILED,
        Date.now() - startedAt,
        error,
      );
      throw error;
    }
  };

  await runStep(AI_TRIAGE_LOG_STEP_CLASSIFICATION, async () => {
    await applyClassificationGovernanceActions(context, actionPlan.classification);
  });

  await runStep(AI_TRIAGE_LOG_STEP_DUPLICATE, async () => {
    await applyDuplicateGovernanceActions(context, actionPlan.duplicate);
  });

  await runStep(AI_TRIAGE_LOG_STEP_TONE, async () => {
    for (const labelToAdd of actionPlan.tone.labelsToAdd) {
      await context.addLabelIfMissing(labelToAdd);
    }
  });

  await applyQuestionResponseGovernanceActions(context, actionPlan.question);

  if (context.actionsAppliedCount === 0) {
    context.logger?.debug?.('AnalyzeIssueWithAiUseCase no governance actions were applied.', {
      repositoryFullName: context.repositoryFullName,
      issueNumber: context.issue.number,
      action: context.action,
    });
  }

  return {
    actionsAppliedCount: context.actionsAppliedCount,
    effectiveTone: context.effectiveTone,
  };
};
