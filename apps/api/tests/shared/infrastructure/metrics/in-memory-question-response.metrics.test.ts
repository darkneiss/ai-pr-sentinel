import { createInMemoryQuestionResponseMetrics } from '../../../../src/shared/infrastructure/metrics/in-memory-question-response.metrics';

describe('InMemoryQuestionResponseMetrics', () => {
  it('should start with all counters at zero', () => {
    // Arrange
    const metrics = createInMemoryQuestionResponseMetrics();

    // Act
    const snapshot = metrics.snapshot();

    // Assert
    expect(snapshot).toEqual({
      aiSuggestedResponse: 0,
      fallbackChecklist: 0,
      total: 0,
    });
  });

  it('should increment ai_suggested_response counter', () => {
    // Arrange
    const metrics = createInMemoryQuestionResponseMetrics();

    // Act
    metrics.increment('ai_suggested_response');
    const snapshot = metrics.snapshot();

    // Assert
    expect(snapshot).toEqual({
      aiSuggestedResponse: 1,
      fallbackChecklist: 0,
      total: 1,
    });
  });

  it('should increment fallback_checklist counter', () => {
    // Arrange
    const metrics = createInMemoryQuestionResponseMetrics();

    // Act
    metrics.increment('fallback_checklist');
    metrics.increment('fallback_checklist');
    const snapshot = metrics.snapshot();

    // Assert
    expect(snapshot).toEqual({
      aiSuggestedResponse: 0,
      fallbackChecklist: 2,
      total: 2,
    });
  });
});
