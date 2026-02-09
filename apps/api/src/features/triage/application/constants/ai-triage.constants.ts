import type { ConfigPort } from '../../../../shared/application/ports/config.port';

export const AI_CLASSIFICATION_CONFIDENCE_THRESHOLD = 0.8;
export const AI_SENTIMENT_CONFIDENCE_THRESHOLD = 0.75;
export const AI_DUPLICATE_SIMILARITY_THRESHOLD = 0.85;
export const AI_RECENT_ISSUES_LIMIT = 15;
const LLM_TIMEOUT_ENV_VAR = 'LLM_TIMEOUT';
const LLM_PROVIDER_ENV_VAR = 'LLM_PROVIDER';
export const LLM_LOG_RAW_RESPONSE_ENV_VAR = 'LLM_LOG_RAW_RESPONSE';
export const LLM_RAW_TEXT_LOG_PREVIEW_CHARS = 2000;
const DEFAULT_LLM_PROVIDER = 'ollama';
const AI_TIMEOUT_DEFAULT_MS = 120000;
const AI_TIMEOUT_OLLAMA_MS = 240000;
const AI_TIMEOUT_GEMINI_MS = 120000;
const AI_TIMEOUT_GROQ_MS = 120000;
export const AI_MAX_TOKENS = 700;
export const AI_TEMPERATURE = 0.1;

const parseTimeoutOverride = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return Math.trunc(parsed);
};

export const resolveAiTimeoutMs = (config?: ConfigPort): number => {
  const override = parseTimeoutOverride(config?.get(LLM_TIMEOUT_ENV_VAR));
  if (override !== undefined) {
    return override;
  }

  const providerValue = (config?.get(LLM_PROVIDER_ENV_VAR) ?? DEFAULT_LLM_PROVIDER).toLowerCase();
  switch (providerValue) {
    case 'ollama':
      return AI_TIMEOUT_OLLAMA_MS;
    case 'gemini':
      return AI_TIMEOUT_GEMINI_MS;
    case 'groq':
      return AI_TIMEOUT_GROQ_MS;
    default:
      return AI_TIMEOUT_DEFAULT_MS;
  }
};

export const AI_SUPPORTED_ACTIONS = ['opened', 'edited'] as const;

export const AI_TRIAGE_DUPLICATE_LABEL = 'triage/duplicate';
export const AI_TRIAGE_MONITOR_LABEL = 'triage/monitor';
export const AI_KIND_BUG_LABEL = 'kind/bug';
export const AI_KIND_FEATURE_LABEL = 'kind/feature';
export const AI_KIND_QUESTION_LABEL = 'kind/question';
export const AI_KIND_LABELS = [AI_KIND_BUG_LABEL, AI_KIND_FEATURE_LABEL, AI_KIND_QUESTION_LABEL] as const;

export const AI_DUPLICATE_COMMENT_PREFIX = 'AI Triage: Possible duplicate of #';
export const AI_QUESTION_REPLY_COMMENT_PREFIX = 'AI Triage: Suggested';
export const AI_QUESTION_AI_REPLY_COMMENT_PREFIX = 'AI Triage: Suggested guidance';
export const AI_QUESTION_FALLBACK_REPLY_COMMENT_PREFIX = 'AI Triage: Suggested setup checklist';
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
