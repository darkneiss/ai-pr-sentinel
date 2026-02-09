export interface IssueTriagePromptConfig {
  temperature?: number;
  maxTokens?: number;
}

export interface IssueTriagePrompt {
  version: string;
  provider: string;
  systemPrompt: string;
  userPromptTemplate: string;
  outputContract?: string;
  config?: IssueTriagePromptConfig;
}

export interface IssueTriagePromptGateway {
  getPrompt: (params?: { provider?: string; version?: string }) => IssueTriagePrompt;
}
