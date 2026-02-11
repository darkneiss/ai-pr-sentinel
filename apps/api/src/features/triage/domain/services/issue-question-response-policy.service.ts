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
