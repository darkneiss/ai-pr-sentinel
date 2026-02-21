import type { ConfigPort } from '../../../../shared/application/ports/config.port';

export const AI_CLASSIFICATION_CONFIDENCE_THRESHOLD = 0.8;
export const AI_SENTIMENT_CONFIDENCE_THRESHOLD = 0.75;
export const AI_DUPLICATE_SIMILARITY_THRESHOLD = 0.85;
export const AI_CLASSIFICATION_CONFIDENCE_THRESHOLD_ENV_VAR = 'AI_CLASSIFICATION_CONFIDENCE_THRESHOLD';
export const AI_SENTIMENT_CONFIDENCE_THRESHOLD_ENV_VAR = 'AI_SENTIMENT_CONFIDENCE_THRESHOLD';
export const AI_DUPLICATE_SIMILARITY_THRESHOLD_ENV_VAR = 'AI_DUPLICATE_SIMILARITY_THRESHOLD';
export const AI_RECENT_ISSUES_LIMIT = 15;
const LLM_TIMEOUT_ENV_VAR = 'LLM_TIMEOUT';
export const AI_TEMPERATURE_ENV_VAR = 'AI_TEMPERATURE';
export const LLM_PROVIDER_ENV_VAR = 'LLM_PROVIDER';
export const LLM_MODEL_ENV_VAR = 'LLM_MODEL';
export const LLM_LOG_RAW_RESPONSE_ENV_VAR = 'LLM_LOG_RAW_RESPONSE';
export const AI_LABEL_KIND_BUG_ENV_VAR = 'AI_LABEL_KIND_BUG';
export const AI_LABEL_KIND_FEATURE_ENV_VAR = 'AI_LABEL_KIND_FEATURE';
export const AI_LABEL_KIND_QUESTION_ENV_VAR = 'AI_LABEL_KIND_QUESTION';
export const AI_LABEL_DOCUMENTATION_ENV_VAR = 'AI_LABEL_DOCUMENTATION';
export const AI_LABEL_HELP_WANTED_ENV_VAR = 'AI_LABEL_HELP_WANTED';
export const AI_LABEL_GOOD_FIRST_ISSUE_ENV_VAR = 'AI_LABEL_GOOD_FIRST_ISSUE';
export const AI_LABEL_DOCUMENTATION_CONFIDENCE_THRESHOLD_ENV_VAR =
  'AI_LABEL_DOCUMENTATION_CONFIDENCE_THRESHOLD';
export const AI_LABEL_HELP_WANTED_CONFIDENCE_THRESHOLD_ENV_VAR =
  'AI_LABEL_HELP_WANTED_CONFIDENCE_THRESHOLD';
export const AI_LABEL_GOOD_FIRST_ISSUE_CONFIDENCE_THRESHOLD_ENV_VAR =
  'AI_LABEL_GOOD_FIRST_ISSUE_CONFIDENCE_THRESHOLD';
export const LLM_RAW_TEXT_LOG_PREVIEW_CHARS = 2000;
export const DEFAULT_LLM_PROVIDER = 'ollama';
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

export const AI_TRIAGE_DUPLICATE_LABEL = 'triage/duplicate';
export const AI_TRIAGE_MONITOR_LABEL = 'triage/monitor';
export const AI_TRIAGE_DEFERRED_LABEL = 'triage/ai-deferred';
export const AI_KIND_BUG_LABEL = 'kind/bug';
export const AI_KIND_FEATURE_LABEL = 'kind/feature';
export const AI_KIND_QUESTION_LABEL = 'kind/question';
export const AI_KIND_LABELS = [AI_KIND_BUG_LABEL, AI_KIND_FEATURE_LABEL, AI_KIND_QUESTION_LABEL] as const;
export const AI_DOCUMENTATION_LABEL = 'documentation';
export const AI_HELP_WANTED_LABEL = 'help wanted';
export const AI_GOOD_FIRST_ISSUE_LABEL = 'good first issue';

export const AI_DOCUMENTATION_LABEL_CONFIDENCE_THRESHOLD = 0.9;
export const AI_HELP_WANTED_LABEL_CONFIDENCE_THRESHOLD = 0.9;
export const AI_GOOD_FIRST_ISSUE_LABEL_CONFIDENCE_THRESHOLD = 0.95;

export type AiKindLabelConfig = {
  bugLabel: string;
  featureLabel: string;
  questionLabel: string;
  kindLabels: [string, string, string];
};

export type AiCurationLabelConfig = {
  documentationLabel: string;
  helpWantedLabel: string;
  goodFirstIssueLabel: string;
};

export type AiCurationConfidenceThresholdConfig = {
  documentationConfidenceThreshold: number;
  helpWantedConfidenceThreshold: number;
  goodFirstIssueConfidenceThreshold: number;
};

export type AiDecisionThresholdConfig = {
  classificationConfidenceThreshold: number;
  sentimentConfidenceThreshold: number;
  duplicateSimilarityThreshold: number;
};

const resolveConfiguredLabel = (configuredValue: string | undefined, fallbackLabel: string): string => {
  const normalizedConfiguredValue = configuredValue?.trim();
  if (!normalizedConfiguredValue) {
    return fallbackLabel;
  }

  return normalizedConfiguredValue;
};

const parseConfidenceThresholdOverride = (configuredValue: string | undefined): number | undefined => {
  if (!configuredValue) {
    return undefined;
  }

  const parsed = Number(configuredValue);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return undefined;
  }

  return parsed;
};

export const resolveAiKindLabels = (config?: ConfigPort): AiKindLabelConfig => {
  const bugLabel = resolveConfiguredLabel(config?.get(AI_LABEL_KIND_BUG_ENV_VAR), AI_KIND_BUG_LABEL);
  const featureLabel = resolveConfiguredLabel(
    config?.get(AI_LABEL_KIND_FEATURE_ENV_VAR),
    AI_KIND_FEATURE_LABEL,
  );
  const questionLabel = resolveConfiguredLabel(
    config?.get(AI_LABEL_KIND_QUESTION_ENV_VAR),
    AI_KIND_QUESTION_LABEL,
  );

  return {
    bugLabel,
    featureLabel,
    questionLabel,
    kindLabels: [bugLabel, featureLabel, questionLabel],
  };
};

export const resolveAiCurationLabels = (config?: ConfigPort): AiCurationLabelConfig => {
  return {
    documentationLabel: resolveConfiguredLabel(
      config?.get(AI_LABEL_DOCUMENTATION_ENV_VAR),
      AI_DOCUMENTATION_LABEL,
    ),
    helpWantedLabel: resolveConfiguredLabel(
      config?.get(AI_LABEL_HELP_WANTED_ENV_VAR),
      AI_HELP_WANTED_LABEL,
    ),
    goodFirstIssueLabel: resolveConfiguredLabel(
      config?.get(AI_LABEL_GOOD_FIRST_ISSUE_ENV_VAR),
      AI_GOOD_FIRST_ISSUE_LABEL,
    ),
  };
};

export const resolveAiCurationConfidenceThresholds = (
  config?: ConfigPort,
): AiCurationConfidenceThresholdConfig => {
  return {
    documentationConfidenceThreshold:
      parseConfidenceThresholdOverride(config?.get(AI_LABEL_DOCUMENTATION_CONFIDENCE_THRESHOLD_ENV_VAR)) ??
      AI_DOCUMENTATION_LABEL_CONFIDENCE_THRESHOLD,
    helpWantedConfidenceThreshold:
      parseConfidenceThresholdOverride(config?.get(AI_LABEL_HELP_WANTED_CONFIDENCE_THRESHOLD_ENV_VAR)) ??
      AI_HELP_WANTED_LABEL_CONFIDENCE_THRESHOLD,
    goodFirstIssueConfidenceThreshold:
      parseConfidenceThresholdOverride(config?.get(AI_LABEL_GOOD_FIRST_ISSUE_CONFIDENCE_THRESHOLD_ENV_VAR)) ??
      AI_GOOD_FIRST_ISSUE_LABEL_CONFIDENCE_THRESHOLD,
  };
};

export const resolveAiDecisionThresholds = (config?: ConfigPort): AiDecisionThresholdConfig => {
  return {
    classificationConfidenceThreshold:
      parseConfidenceThresholdOverride(config?.get(AI_CLASSIFICATION_CONFIDENCE_THRESHOLD_ENV_VAR)) ??
      AI_CLASSIFICATION_CONFIDENCE_THRESHOLD,
    sentimentConfidenceThreshold:
      parseConfidenceThresholdOverride(config?.get(AI_SENTIMENT_CONFIDENCE_THRESHOLD_ENV_VAR)) ??
      AI_SENTIMENT_CONFIDENCE_THRESHOLD,
    duplicateSimilarityThreshold:
      parseConfidenceThresholdOverride(config?.get(AI_DUPLICATE_SIMILARITY_THRESHOLD_ENV_VAR)) ??
      AI_DUPLICATE_SIMILARITY_THRESHOLD,
  };
};

export const resolveAiTemperature = (config?: ConfigPort): number => {
  return parseConfidenceThresholdOverride(config?.get(AI_TEMPERATURE_ENV_VAR)) ?? AI_TEMPERATURE;
};

export const AI_DUPLICATE_COMMENT_PREFIX = 'AI Triage: Possible duplicate of #';
export const AI_TRIAGE_DEFERRED_COMMENT_PREFIX = 'AI Triage: Deferred due to provider limits';
export const AI_TRIAGE_DEFERRED_COMMENT_BODY = [
  `${AI_TRIAGE_DEFERRED_COMMENT_PREFIX}.`,
  'AI triage has been deferred because the LLM provider rate limit or quota was exceeded.',
  '',
  'Please edit or reopen this issue later to trigger a retry.',
].join('\n');
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

export const AI_TRIAGE_LOG_EVENT_STARTED = 'ai_triage_started';
export const AI_TRIAGE_LOG_EVENT_COMPLETED = 'ai_triage_completed';
export const AI_TRIAGE_LOG_EVENT_FAILED = 'ai_triage_failed';

export const AI_TRIAGE_LOG_STATUS_STARTED = 'started';
export const AI_TRIAGE_LOG_STATUS_COMPLETED = 'completed';
export const AI_TRIAGE_LOG_STATUS_FAILED = 'failed';

export const AI_TRIAGE_LOG_STEP_CLASSIFICATION = 'classification';
export const AI_TRIAGE_LOG_STEP_DUPLICATE = 'duplicate';
export const AI_TRIAGE_LOG_STEP_TONE = 'tone';
export const AI_TRIAGE_LOG_STEPS = [
  AI_TRIAGE_LOG_STEP_CLASSIFICATION,
  AI_TRIAGE_LOG_STEP_DUPLICATE,
  AI_TRIAGE_LOG_STEP_TONE,
] as const;
export type AiTriageLogStep = (typeof AI_TRIAGE_LOG_STEPS)[number];

export const AI_TRIAGE_LOG_START_DURATION_MS = 0;
export const AI_TRIAGE_LOG_UNKNOWN_VALUE = 'unknown';
