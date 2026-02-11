import {
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
import { shouldApplyIssueToneMonitorLabel } from '../../domain/services/issue-tone-monitor-policy.service';
import { applyClassificationGovernanceActions } from './apply-classification-governance-actions.service';
import { applyDuplicateGovernanceActions } from './apply-duplicate-governance-actions.service';
import { applyQuestionResponseGovernanceActions } from './apply-question-response-governance-actions.service';

export const applyAiTriageGovernanceActions = async (
  input: ApplyAiTriageGovernanceActionsInput,
): Promise<ApplyAiTriageGovernanceActionsResult> => {
  const context = createAiTriageGovernanceActionsExecutionContext(input);

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
    await applyClassificationGovernanceActions(context);
  });

  await runStep(AI_TRIAGE_LOG_STEP_DUPLICATE, async () => {
    await applyDuplicateGovernanceActions(context);
  });

  await runStep(AI_TRIAGE_LOG_STEP_TONE, async () => {
    if (!shouldApplyIssueToneMonitorLabel({ effectiveTone: context.effectiveTone })) {
      return;
    }

    await context.addLabelIfMissing(AI_TRIAGE_MONITOR_LABEL);
  });

  await applyQuestionResponseGovernanceActions(context);

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
