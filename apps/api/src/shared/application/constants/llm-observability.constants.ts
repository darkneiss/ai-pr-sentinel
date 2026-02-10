export const LLM_OBSERVABILITY_RUN_NAME = 'issue_triage_llm';
export const LLM_OBSERVABILITY_RUN_TYPE = 'llm';
export const LLM_OBSERVABILITY_MAX_TEXT_CHARS = 2000;
export const LLM_OBSERVABILITY_REDACTED_VALUE = '[REDACTED]';
export const LLM_OBSERVABILITY_SENSITIVE_KEYS = [
  'api_key',
  'apikey',
  'authorization',
  'token',
  'secret',
  'password',
] as const;
export const LLM_OBSERVABILITY_PROMPT_KEYS = ['systemPrompt', 'userPrompt'] as const;
