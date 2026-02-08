export const QUESTION_RESPONSE_SOURCES = ['ai_suggested_response', 'fallback_checklist'] as const;

export type QuestionResponseSource = (typeof QUESTION_RESPONSE_SOURCES)[number];

export interface QuestionResponseMetricsPort {
  increment(source: QuestionResponseSource): void;
  snapshot(): {
    aiSuggestedResponse: number;
    fallbackChecklist: number;
    total: number;
  };
}
