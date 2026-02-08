import type {
  QuestionResponseMetricsPort,
  QuestionResponseSource,
} from '../../application/ports/question-response-metrics.port';

const INITIAL_COUNT = 0;

interface InMemoryQuestionResponseState {
  aiSuggestedResponse: number;
  fallbackChecklist: number;
}

const createInitialState = (): InMemoryQuestionResponseState => ({
  aiSuggestedResponse: INITIAL_COUNT,
  fallbackChecklist: INITIAL_COUNT,
});

export const createInMemoryQuestionResponseMetrics = (): QuestionResponseMetricsPort => {
  const state = createInitialState();

  return {
    increment: (source: QuestionResponseSource): void => {
      if (source === 'ai_suggested_response') {
        state.aiSuggestedResponse += 1;
        return;
      }

      state.fallbackChecklist += 1;
    },
    snapshot: () => ({
      aiSuggestedResponse: state.aiSuggestedResponse,
      fallbackChecklist: state.fallbackChecklist,
      total: state.aiSuggestedResponse + state.fallbackChecklist,
    }),
  };
};
