import { AI_TRIAGE_MONITOR_LABEL } from '../constants/ai-triage.constants';
import {
  createAiTriageGovernanceActionsExecutionContext,
  type ApplyAiTriageGovernanceActionsInput,
  type ApplyAiTriageGovernanceActionsResult,
} from './ai-triage-governance-actions-context.service';
import { applyClassificationGovernanceActions } from './apply-classification-governance-actions.service';
import { applyDuplicateGovernanceActions } from './apply-duplicate-governance-actions.service';
import { applyQuestionResponseGovernanceActions } from './apply-question-response-governance-actions.service';

export const applyAiTriageGovernanceActions = async (
  input: ApplyAiTriageGovernanceActionsInput,
): Promise<ApplyAiTriageGovernanceActionsResult> => {
  const context = createAiTriageGovernanceActionsExecutionContext(input);

  await applyClassificationGovernanceActions(context);
  await applyDuplicateGovernanceActions(context);

  if (context.effectiveTone === 'hostile') {
    await context.addLabelIfMissing(AI_TRIAGE_MONITOR_LABEL);
  }

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
