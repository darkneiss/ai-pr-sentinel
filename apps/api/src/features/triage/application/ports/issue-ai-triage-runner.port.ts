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

export interface AnalyzeIssueWithAiResult {
  status: 'completed' | 'skipped';
  reason?: 'unsupported_action' | 'ai_unavailable';
}

export type IssueAiTriageRunner = (
  input: AnalyzeIssueWithAiInput,
) => Promise<AnalyzeIssueWithAiResult>;
