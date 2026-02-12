import type { IssueAiTriageProcessingResult } from '../services/issue-ai-triage-processing-policy.service';

export interface AnalyzeIssueWithAiInput {
  action: string;
  repositoryFullName: string;
  issue: {
    number: number;
    title: string;
    body: string;
    labels: string[];
  };
}

export type AnalyzeIssueWithAiResult = IssueAiTriageProcessingResult;

export type IssueAiTriageRunner = (
  input: AnalyzeIssueWithAiInput,
) => Promise<AnalyzeIssueWithAiResult>;
