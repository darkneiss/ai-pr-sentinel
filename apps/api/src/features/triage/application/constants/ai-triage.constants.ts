export const AI_CLASSIFICATION_CONFIDENCE_THRESHOLD = 0.8;
export const AI_DUPLICATE_SIMILARITY_THRESHOLD = 0.85;
export const AI_RECENT_ISSUES_LIMIT = 15;
export const AI_TIMEOUT_MS = 7000;
export const AI_MAX_TOKENS = 700;
export const AI_TEMPERATURE = 0.1;

export const AI_SUPPORTED_ACTIONS = ['opened', 'edited'] as const;

export const AI_TRIAGE_DUPLICATE_LABEL = 'triage/duplicate';
export const AI_TRIAGE_MONITOR_LABEL = 'triage/monitor';
export const AI_KIND_BUG_LABEL = 'kind/bug';
export const AI_KIND_FEATURE_LABEL = 'kind/feature';
export const AI_KIND_QUESTION_LABEL = 'kind/question';
export const AI_KIND_LABELS = [AI_KIND_BUG_LABEL, AI_KIND_FEATURE_LABEL, AI_KIND_QUESTION_LABEL] as const;

export const AI_DUPLICATE_COMMENT_PREFIX = 'AI Triage: Possible duplicate of #';
export const AI_QUESTION_REPLY_COMMENT_PREFIX = 'AI Triage: Suggested setup checklist';
export const AI_QUESTION_SIGNAL_KEYWORDS = [
  'how',
  'can i',
  'como',
  'cómo',
  'ayuda',
] as const;
export const AI_QUESTION_FALLBACK_CHECKLIST = [
  '- Share your current `.env` values (without secrets).',
  '- Share exact commands you already ran and their output.',
  '- Describe expected behavior vs actual behavior.',
  '- Include relevant logs/errors from the API process.',
] as const;
