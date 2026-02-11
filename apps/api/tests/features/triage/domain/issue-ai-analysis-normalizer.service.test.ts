import { parseAiAnalysis } from '../../../../src/features/triage/domain/services/issue-ai-analysis-normalizer.service';

describe('IssueAiAnalysisNormalizerService', () => {
  it('should parse structured ai analysis payloads', () => {
    // Arrange
    const rawText = JSON.stringify({
      classification: {
        type: 'bug',
        confidence: 0.9,
        reasoning: 'Clear bug report',
      },
      duplicateDetection: {
        isDuplicate: false,
        originalIssueNumber: null,
        similarityScore: 0.1,
      },
      sentiment: {
        tone: 'neutral',
        confidence: 0.8,
        reasoning: 'Neutral tone',
      },
      suggestedResponse: 'Provide reproduction steps.',
    });

    // Act
    const result = parseAiAnalysis(rawText, 42);

    // Assert
    expect(result).toEqual({
      classification: {
        type: 'bug',
        confidence: 0.9,
        reasoning: 'Clear bug report',
      },
      duplicateDetection: {
        isDuplicate: false,
        originalIssueNumber: null,
        similarityScore: 0.1,
      },
      sentiment: {
        tone: 'neutral',
        confidence: 0.8,
        reasoning: 'Neutral tone',
      },
      suggestedResponse: 'Provide reproduction steps.',
    });
  });

  it('should return undefined when payload is invalid json', () => {
    // Arrange
    const rawText = '{invalid-json';

    // Act
    const result = parseAiAnalysis(rawText, 42);

    // Assert
    expect(result).toBeUndefined();
  });
});
