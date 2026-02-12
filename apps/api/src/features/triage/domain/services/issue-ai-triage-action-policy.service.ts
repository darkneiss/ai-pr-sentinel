export const AI_TRIAGE_SUPPORTED_ACTIONS = ['opened', 'edited'] as const;

export type IssueAiTriageAction = (typeof AI_TRIAGE_SUPPORTED_ACTIONS)[number];

export const isIssueAiTriageActionSupported = (action: string): action is IssueAiTriageAction =>
  AI_TRIAGE_SUPPORTED_ACTIONS.includes(action as IssueAiTriageAction);
