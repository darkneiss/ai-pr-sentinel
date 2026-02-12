import { isIssueAiTriageActionSupported } from './issue-ai-triage-action-policy.service';

export type IssueAiTriageProcessingStatus = 'completed' | 'skipped';
export type IssueAiTriageProcessingReason = 'unsupported_action' | 'ai_unavailable';

export interface IssueAiTriageProcessingResult {
  status: IssueAiTriageProcessingStatus;
  reason?: IssueAiTriageProcessingReason;
}

const AI_TRIAGE_FAIL_OPEN_RESULT: IssueAiTriageProcessingResult = {
  status: 'skipped',
  reason: 'ai_unavailable',
};

const AI_TRIAGE_COMPLETED_RESULT: IssueAiTriageProcessingResult = {
  status: 'completed',
};

export const decideIssueAiTriageActionProcessing = (
  action: string,
): IssueAiTriageProcessingResult | null => {
  if (isIssueAiTriageActionSupported(action)) {
    return null;
  }

  return {
    status: 'skipped',
    reason: 'unsupported_action',
  };
};

export const decideIssueAiTriageParsingResult = (
  hasParsedAiAnalysis: boolean,
): IssueAiTriageProcessingResult => {
  if (!hasParsedAiAnalysis) {
    return AI_TRIAGE_FAIL_OPEN_RESULT;
  }

  return AI_TRIAGE_COMPLETED_RESULT;
};

export const decideIssueAiTriageFailOpenResult = (): IssueAiTriageProcessingResult =>
  AI_TRIAGE_FAIL_OPEN_RESULT;
