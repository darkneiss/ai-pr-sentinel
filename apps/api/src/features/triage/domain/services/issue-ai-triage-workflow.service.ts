import type { AiAnalysis } from './issue-ai-analysis.types';
import { parseAiAnalysis } from './issue-ai-analysis-normalizer.service';
import {
  decideIssueAiTriageActionProcessing,
  decideIssueAiTriageFailOpenResult,
  decideIssueAiTriageParsingResult,
  type IssueAiTriageProcessingResult,
} from './issue-ai-triage-processing-policy.service';

export type IssueAiTriageWorkflowStartDecision =
  | {
      shouldContinue: false;
      result: IssueAiTriageProcessingResult;
    }
  | {
      shouldContinue: true;
      result: null;
    };

export interface IssueAiTriageWorkflowAfterLlmDecision {
  shouldApplyGovernanceActions: boolean;
  aiAnalysis: AiAnalysis | null;
  result: IssueAiTriageProcessingResult;
}

export const decideIssueAiTriageWorkflowOnStart = (action: string): IssueAiTriageWorkflowStartDecision => {
  const actionDecision = decideIssueAiTriageActionProcessing(action);
  if (actionDecision) {
    return {
      shouldContinue: false,
      result: actionDecision,
    };
  }

  return {
    shouldContinue: true,
    result: null,
  };
};

export const decideIssueAiTriageWorkflowAfterLlm = (
  aiAnalysis: AiAnalysis | undefined,
): IssueAiTriageWorkflowAfterLlmDecision => {
  const parsingResult = decideIssueAiTriageParsingResult(aiAnalysis !== undefined);
  if (parsingResult.status === 'skipped' || !aiAnalysis) {
    return {
      shouldApplyGovernanceActions: false,
      aiAnalysis: null,
      result: parsingResult,
    };
  }

  return {
    shouldApplyGovernanceActions: true,
    aiAnalysis,
    result: parsingResult,
  };
};

export const decideIssueAiTriageWorkflowFromRawText = (
  rawText: string,
  issueNumber: number,
): IssueAiTriageWorkflowAfterLlmDecision => {
  const aiAnalysis = parseAiAnalysis(rawText, issueNumber);
  return decideIssueAiTriageWorkflowAfterLlm(aiAnalysis);
};

export const decideIssueAiTriageWorkflowOnUnhandledFailure = (): IssueAiTriageProcessingResult =>
  decideIssueAiTriageFailOpenResult();
