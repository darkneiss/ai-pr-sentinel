export type IssueQuestionResponseSource = 'ai_suggested_response' | 'fallback_checklist';

export interface IsLikelyQuestionIssueContentInput {
  title: string;
  body: string;
  questionSignalKeywords: readonly string[];
}

export interface DecideIssueQuestionResponseActionInput {
  action: string;
  effectiveTone: 'positive' | 'neutral' | 'hostile';
  classificationType: 'bug' | 'feature' | 'question';
  classificationConfidence: number;
  classificationConfidenceThreshold: number;
  looksLikeQuestionIssue: boolean;
  normalizedSuggestedResponse: string;
  fallbackQuestionResponse: string;
}

export interface IssueQuestionResponseDecision {
  shouldCreateComment: boolean;
  responseSource: IssueQuestionResponseSource | null;
  responseBody: string;
}

export type IssueQuestionResponseCommentDecision = IssueQuestionResponseDecision & {
  shouldCreateComment: true;
  responseSource: IssueQuestionResponseSource;
};

export interface ShouldPublishIssueQuestionResponseCommentInput {
  hasExistingQuestionReplyComment: boolean;
}

export interface DetectRepositoryContextUsageInResponseInput {
  suggestedResponse: string;
  repositoryReadme: string | undefined;
}

const QUESTION_RESPONSE_LINE_SEPARATOR = '\n';
const QUESTION_RESPONSE_COMMENT_SEPARATOR = '\n\n';
const CONTEXT_STOP_WORDS = new Set([
  'this',
  'that',
  'with',
  'from',
  'have',
  'your',
  'about',
  'into',
  'there',
  'which',
  'when',
  'where',
  'what',
  'how',
  'for',
  'and',
  'the',
  'are',
  'you',
  'repo',
  'readme',
  'issue',
  'setup',
  'checklist',
]);
const CONTEXT_TOKEN_MIN_LENGTH = 5;
const CONTEXT_USAGE_MIN_TOKEN_OVERLAP = 2;

const extractMeaningfulContextTokens = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= CONTEXT_TOKEN_MIN_LENGTH && !CONTEXT_STOP_WORDS.has(token));

export const normalizeIssueQuestionSuggestedResponse = (suggestedResponse: string | undefined): string => {
  if (typeof suggestedResponse !== 'string') {
    return '';
  }

  const normalizedSuggestedResponse = suggestedResponse.trim();
  return normalizedSuggestedResponse.length > 0 ? normalizedSuggestedResponse : '';
};

export const normalizeIssueQuestionSuggestedResponseValue = (
  suggestedResponseValue: unknown,
): string | undefined => {
  if (typeof suggestedResponseValue === 'string') {
    const normalizedSuggestedResponse = normalizeIssueQuestionSuggestedResponse(suggestedResponseValue);
    return normalizedSuggestedResponse.length > 0 ? normalizedSuggestedResponse : undefined;
  }

  if (Array.isArray(suggestedResponseValue)) {
    const normalizedLines = suggestedResponseValue
      .filter((item): item is string => typeof item === 'string')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (normalizedLines.length > 0) {
      return normalizedLines.join(QUESTION_RESPONSE_LINE_SEPARATOR);
    }
  }

  return undefined;
};

export const buildIssueQuestionFallbackResponse = (checklistLines: readonly string[]): string =>
  checklistLines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(QUESTION_RESPONSE_LINE_SEPARATOR);

export interface BuildIssueQuestionFallbackResponseWhenApplicableInput {
  looksLikeQuestionIssue: boolean;
  checklistLines: readonly string[];
}

export const buildIssueQuestionFallbackResponseWhenApplicable = ({
  looksLikeQuestionIssue,
  checklistLines,
}: BuildIssueQuestionFallbackResponseWhenApplicableInput): string =>
  looksLikeQuestionIssue ? buildIssueQuestionFallbackResponse(checklistLines) : '';

export interface ResolveIssueQuestionResponseCommentPrefixInput {
  responseSource: IssueQuestionResponseSource;
  aiSuggestedResponseCommentPrefix: string;
  fallbackChecklistCommentPrefix: string;
}

export const resolveIssueQuestionResponseCommentPrefix = ({
  responseSource,
  aiSuggestedResponseCommentPrefix,
  fallbackChecklistCommentPrefix,
}: ResolveIssueQuestionResponseCommentPrefixInput): string =>
  responseSource === 'ai_suggested_response'
    ? aiSuggestedResponseCommentPrefix
    : fallbackChecklistCommentPrefix;

export interface BuildIssueQuestionResponseCommentInput {
  commentPrefix: string;
  responseBody: string;
}

export const buildIssueQuestionResponseComment = ({
  commentPrefix,
  responseBody,
}: BuildIssueQuestionResponseCommentInput): string =>
  `${commentPrefix}${QUESTION_RESPONSE_COMMENT_SEPARATOR}${responseBody}`;

export const isLikelyQuestionIssueContent = ({
  title,
  body,
  questionSignalKeywords,
}: IsLikelyQuestionIssueContentInput): boolean => {
  const normalizedText = `${title}\n${body}`.toLowerCase();
  if (normalizedText.includes('?') || normalizedText.includes('¿')) {
    return true;
  }

  return questionSignalKeywords.some((keyword) => normalizedText.includes(keyword));
};

export const decideIssueQuestionResponseAction = ({
  action,
  effectiveTone,
  classificationType,
  classificationConfidence,
  classificationConfidenceThreshold,
  looksLikeQuestionIssue,
  normalizedSuggestedResponse,
  fallbackQuestionResponse,
}: DecideIssueQuestionResponseActionInput): IssueQuestionResponseDecision => {
  const hasHighConfidenceQuestionClassification =
    classificationType === 'question' && classificationConfidence >= classificationConfidenceThreshold;
  const isHostileTone = effectiveTone === 'hostile';
  const responseBody =
    normalizedSuggestedResponse.length > 0 ? normalizedSuggestedResponse : fallbackQuestionResponse;
  const responseSource: IssueQuestionResponseSource | null =
    normalizedSuggestedResponse.length > 0
      ? 'ai_suggested_response'
      : responseBody.length > 0
        ? 'fallback_checklist'
        : null;
  const shouldCreateComment =
    action === 'opened' &&
    !isHostileTone &&
    (hasHighConfidenceQuestionClassification || looksLikeQuestionIssue) &&
    responseBody.length > 0;

  if (!shouldCreateComment || responseSource === null) {
    return {
      shouldCreateComment: false,
      responseSource: null,
      responseBody: '',
    };
  }

  return {
    shouldCreateComment: true,
    responseSource,
    responseBody,
  };
};

export const shouldPrepareIssueQuestionResponseComment = (
  decision: IssueQuestionResponseDecision,
): decision is IssueQuestionResponseCommentDecision =>
  decision.shouldCreateComment && decision.responseSource !== null && decision.responseBody.length > 0;

export const shouldPublishIssueQuestionResponseComment = ({
  hasExistingQuestionReplyComment,
}: ShouldPublishIssueQuestionResponseCommentInput): boolean => !hasExistingQuestionReplyComment;

export const detectRepositoryContextUsageInResponse = ({
  suggestedResponse,
  repositoryReadme,
}: DetectRepositoryContextUsageInResponseInput): boolean => {
  if (!repositoryReadme || repositoryReadme.trim().length === 0) {
    return false;
  }

  const contextTokens = new Set(extractMeaningfulContextTokens(repositoryReadme));
  if (contextTokens.size === 0) {
    return false;
  }

  let overlapCount = 0;
  for (const responseToken of extractMeaningfulContextTokens(suggestedResponse)) {
    if (contextTokens.has(responseToken)) {
      overlapCount += 1;
      if (overlapCount >= CONTEXT_USAGE_MIN_TOKEN_OVERLAP) {
        return true;
      }
    }
  }

  return false;
};
