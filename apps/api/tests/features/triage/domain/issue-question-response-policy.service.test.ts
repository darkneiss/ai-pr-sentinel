import {
  decideIssueQuestionResponseAction,
  isLikelyQuestionIssueContent,
} from '../../../../src/features/triage/domain/services/issue-question-response-policy.service';

describe('IssueQuestionResponsePolicyService', () => {
  it('should skip comment when action is edited', () => {
    // Arrange
    const input = {
      action: 'edited' as const,
      effectiveTone: 'neutral' as const,
      classificationType: 'question' as const,
      classificationConfidence: 0.95,
      classificationConfidenceThreshold: 0.8,
      looksLikeQuestionIssue: true,
      normalizedSuggestedResponse: 'Use npm install',
      fallbackQuestionResponse: 'Fallback checklist',
    };

    // Act
    const result = decideIssueQuestionResponseAction(input);

    // Assert
    expect(result).toEqual({
      shouldCreateComment: false,
      responseSource: null,
      responseBody: '',
    });
  });

  it('should skip comment when tone is hostile', () => {
    // Arrange
    const input = {
      action: 'opened' as const,
      effectiveTone: 'hostile' as const,
      classificationType: 'question' as const,
      classificationConfidence: 0.95,
      classificationConfidenceThreshold: 0.8,
      looksLikeQuestionIssue: true,
      normalizedSuggestedResponse: 'Use npm install',
      fallbackQuestionResponse: 'Fallback checklist',
    };

    // Act
    const result = decideIssueQuestionResponseAction(input);

    // Assert
    expect(result).toEqual({
      shouldCreateComment: false,
      responseSource: null,
      responseBody: '',
    });
  });

  it('should create ai-suggested comment when confidence is high', () => {
    // Arrange
    const input = {
      action: 'opened' as const,
      effectiveTone: 'neutral' as const,
      classificationType: 'question' as const,
      classificationConfidence: 0.9,
      classificationConfidenceThreshold: 0.8,
      looksLikeQuestionIssue: false,
      normalizedSuggestedResponse: 'Use npm install',
      fallbackQuestionResponse: '',
    };

    // Act
    const result = decideIssueQuestionResponseAction(input);

    // Assert
    expect(result).toEqual({
      shouldCreateComment: true,
      responseSource: 'ai_suggested_response',
      responseBody: 'Use npm install',
    });
  });

  it('should create fallback comment when issue looks like a question without ai suggestion', () => {
    // Arrange
    const input = {
      action: 'opened' as const,
      effectiveTone: 'neutral' as const,
      classificationType: 'bug' as const,
      classificationConfidence: 0.2,
      classificationConfidenceThreshold: 0.8,
      looksLikeQuestionIssue: true,
      normalizedSuggestedResponse: '',
      fallbackQuestionResponse: 'Fallback checklist',
    };

    // Act
    const result = decideIssueQuestionResponseAction(input);

    // Assert
    expect(result).toEqual({
      shouldCreateComment: true,
      responseSource: 'fallback_checklist',
      responseBody: 'Fallback checklist',
    });
  });

  it('should skip comment when neither ai suggestion nor fallback are available', () => {
    // Arrange
    const input = {
      action: 'opened' as const,
      effectiveTone: 'neutral' as const,
      classificationType: 'question' as const,
      classificationConfidence: 0.9,
      classificationConfidenceThreshold: 0.8,
      looksLikeQuestionIssue: true,
      normalizedSuggestedResponse: '',
      fallbackQuestionResponse: '',
    };

    // Act
    const result = decideIssueQuestionResponseAction(input);

    // Assert
    expect(result).toEqual({
      shouldCreateComment: false,
      responseSource: null,
      responseBody: '',
    });
  });

  it('should detect question-like issue when text includes question mark', () => {
    // Arrange
    const input = {
      title: 'How to run this?',
      body: 'I need help with setup.',
      questionSignalKeywords: ['help', 'how to'],
    };

    // Act
    const result = isLikelyQuestionIssueContent(input);

    // Assert
    expect(result).toBe(true);
  });

  it('should detect question-like issue when text includes configured keywords', () => {
    // Arrange
    const input = {
      title: 'Setup guidance',
      body: 'Need help to configure CI',
      questionSignalKeywords: ['help', 'how to'],
    };

    // Act
    const result = isLikelyQuestionIssueContent(input);

    // Assert
    expect(result).toBe(true);
  });

  it('should not detect question-like issue when there are no markers', () => {
    // Arrange
    const input = {
      title: 'Refactor logger output',
      body: 'I changed implementation details and updated tests.',
      questionSignalKeywords: ['help', 'how to'],
    };

    // Act
    const result = isLikelyQuestionIssueContent(input);

    // Assert
    expect(result).toBe(false);
  });
});
