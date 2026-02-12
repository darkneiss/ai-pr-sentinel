import { parseAiAnalysis } from '../../../../src/features/triage/domain/services/issue-ai-analysis-normalizer.service';

describe('IssueAiAnalysisLabelRecommendationsNormalizerService', () => {
  it('should accept valid direct ai-analysis label recommendations shape', () => {
    // Arrange
    const rawText = JSON.stringify({
      classification: {
        type: 'bug',
        confidence: 0.95,
        reasoning: 'Bug detected',
      },
      duplicateDetection: {
        isDuplicate: false,
        originalIssueNumber: null,
        similarityScore: 0.1,
      },
      sentiment: {
        tone: 'neutral',
        confidence: 0.7,
        reasoning: 'Neutral tone',
      },
      labelRecommendations: {
        documentation: {
          shouldApply: true,
          confidence: 0.91,
          reasoning: 'Docs are missing',
        },
      },
    });

    // Act
    const result = parseAiAnalysis(rawText, 42);

    // Assert
    expect(result).toEqual({
      classification: {
        type: 'bug',
        confidence: 0.95,
        reasoning: 'Bug detected',
      },
      duplicateDetection: {
        isDuplicate: false,
        originalIssueNumber: null,
        similarityScore: 0.1,
      },
      sentiment: {
        tone: 'neutral',
        confidence: 0.7,
        reasoning: 'Neutral tone',
      },
      labelRecommendations: {
        documentation: {
          shouldApply: true,
          confidence: 0.91,
          reasoning: 'Docs are missing',
        },
      },
    });
  });

  it('should normalize label recommendations from snake_case aliases', () => {
    // Arrange
    const rawText = JSON.stringify({
      classification: {
        type: 'feature',
        confidence: 0.91,
        reasoning: 123,
      },
      duplicateDetection: {
        isDuplicate: false,
        originalIssueNumber: null,
        similarityScore: 0.1,
      },
      sentiment: {
        tone: 'neutral',
        confidence: 0.7,
        reasoning: 'Neutral tone',
      },
      label_recommendations: {
        docs: {
          shouldApply: true,
          confidence: 0.94,
          reasoning: 'Documentation gap detected',
        },
        help_wanted: {
          shouldApply: true,
          confidence: 0.92,
          reasoning: 'Needs contributor help',
        },
        good_first_issue: {
          shouldApply: true,
          confidence: 0.97,
        },
      },
    });

    // Act
    const result = parseAiAnalysis(rawText, 42);

    // Assert
    expect(result?.labelRecommendations).toEqual({
      documentation: {
        shouldApply: true,
        confidence: 0.94,
        reasoning: 'Documentation gap detected',
      },
      helpWanted: {
        shouldApply: true,
        confidence: 0.92,
        reasoning: 'Needs contributor help',
      },
      goodFirstIssue: {
        shouldApply: true,
        confidence: 0.97,
        reasoning: undefined,
      },
    });
  });

  it('should ignore malformed label recommendations in structured payloads', () => {
    // Arrange
    const rawText = JSON.stringify({
      classification: {
        type: 'bug',
        confidence: 0.88,
        reasoning: 123,
      },
      duplicateDetection: {
        isDuplicate: false,
        originalIssueNumber: null,
        similarityScore: 0.2,
      },
      sentiment: {
        tone: 'neutral',
        confidence: 0.6,
        reasoning: 'Neutral',
      },
      labelRecommendations: {
        documentation: 'invalid-shape',
        helpWanted: {
          shouldApply: true,
          confidence: 2,
        },
      },
    });

    // Act
    const result = parseAiAnalysis(rawText, 42);

    // Assert
    expect(result?.labelRecommendations).toBeUndefined();
  });

  it('should normalize label recommendations when model returns an array payload', () => {
    // Arrange
    const rawText = JSON.stringify({
      classification: {
        type: 'question',
        confidence: 1,
      },
      duplicateDetection: {
        isDuplicate: false,
        similarityScore: 0,
      },
      sentiment: {
        tone: 'neutral',
        confidence: 1,
      },
      labelRecommendations: [
        {
          shouldApply: true,
          confidence: 1,
          reasoning: 'Documentation request',
        },
        {
          shouldApply: false,
          confidence: 0.3,
          reasoning: 'No external help requested',
        },
        {
          shouldApply: false,
          confidence: 0.2,
          reasoning: 'Not beginner task',
        },
      ],
      suggestedResponse: 'Checklist',
    });

    // Act
    const result = parseAiAnalysis(rawText, 49);

    // Assert
    expect(result?.labelRecommendations).toEqual({
      documentation: {
        shouldApply: true,
        confidence: 1,
        reasoning: 'Documentation request',
      },
      helpWanted: {
        shouldApply: false,
        confidence: 0.3,
        reasoning: 'No external help requested',
      },
      goodFirstIssue: {
        shouldApply: false,
        confidence: 0.2,
        reasoning: 'Not beginner task',
      },
    });
  });

  it('should fallback to structured normalization when ai-analysis shape has invalid label recommendations', () => {
    // Arrange
    const rawText = JSON.stringify({
      classification: {
        type: 'question',
        confidence: 0.95,
        reasoning: 'Question detected',
      },
      duplicateDetection: {
        isDuplicate: false,
        originalIssueNumber: null,
        similarityScore: 0.1,
      },
      sentiment: {
        tone: 'neutral',
        confidence: 0.8,
        reasoning: 'Neutral',
      },
      labelRecommendations: 7,
    });

    // Act
    const result = parseAiAnalysis(rawText, 42);

    // Assert
    expect(result).toEqual({
      classification: {
        type: 'question',
        confidence: 0.95,
        reasoning: 'Question detected',
      },
      duplicateDetection: {
        isDuplicate: false,
        originalIssueNumber: null,
        similarityScore: 0.1,
        hasExplicitOriginalIssueReference: true,
      },
      sentiment: {
        tone: 'neutral',
        confidence: 0.8,
        reasoning: 'Neutral',
      },
      labelRecommendations: undefined,
      suggestedResponse: undefined,
    });
  });

  it('should return undefined for valid json that is not an object', () => {
    // Arrange
    const rawText = JSON.stringify('not-an-object');

    // Act
    const result = parseAiAnalysis(rawText, 42);

    // Assert
    expect(result).toBeUndefined();
  });

  it('should return undefined when duplicate detection is not an object and no duplicate signals exist', () => {
    // Arrange
    const rawText = JSON.stringify({
      classification: {
        type: 'question',
        confidence: 0.92,
        reasoning: 'Question detected',
      },
      duplicateDetection: 'invalid',
      sentiment: {
        tone: 'neutral',
        confidence: 0.8,
        reasoning: 'Neutral',
      },
    });

    // Act
    const result = parseAiAnalysis(rawText, 42);

    // Assert
    expect(result).toBeUndefined();
  });
});
