describe('App (Question Response Metrics Composition)', () => {
  it('should create question response metrics per app instance', () => {
    // Arrange
    jest.resetModules();
    const createInMemoryQuestionResponseMetricsMock = jest.fn(() => ({
      recordQuestionResponseSource: jest.fn(),
      getSnapshot: jest.fn().mockReturnValue({ aiSuggestedResponse: 0, fallbackChecklist: 0, total: 0 }),
    }));
    jest.doMock('../../../../src/shared/infrastructure/metrics/in-memory-question-response.metrics', () => ({
      createInMemoryQuestionResponseMetrics: createInMemoryQuestionResponseMetricsMock,
    }));

    const { createApp } = require('../../../../src/app') as {
      createApp: () => unknown;
    };

    // Act
    createApp();
    createApp();

    // Assert
    expect(createInMemoryQuestionResponseMetricsMock).toHaveBeenCalledTimes(2);
  });
});
