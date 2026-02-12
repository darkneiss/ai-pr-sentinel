export const ISSUE_WEBHOOK_SUPPORTED_ACTIONS = ['opened', 'edited'] as const;

export type IssueWebhookAction = (typeof ISSUE_WEBHOOK_SUPPORTED_ACTIONS)[number];

export const isIssueWebhookActionSupported = (action: string): action is IssueWebhookAction =>
  ISSUE_WEBHOOK_SUPPORTED_ACTIONS.includes(action as IssueWebhookAction);
