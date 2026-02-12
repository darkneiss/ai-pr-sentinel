import {
  buildIssueQuestionResponseComment,
  decideIssueQuestionResponseCommentPublicationPreparation,
  decideIssueQuestionResponseCommentPublication,
  buildIssueQuestionFallbackResponse,
  buildIssueQuestionFallbackResponseWhenApplicable,
  decideIssueQuestionResponseAction,
  detectRepositoryContextUsageInResponse,
  isLikelyQuestionIssueContent,
  normalizeIssueQuestionSuggestedResponse,
  normalizeIssueQuestionSuggestedResponseValue,
  planIssueQuestionResponseCommentPublication,
  resolveIssueQuestionResponseCommentPrefix,
  shouldPrepareIssueQuestionResponseComment,
  shouldPublishIssueQuestionResponseComment,
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

  it('should detect repository context usage when response overlaps meaningful readme tokens', () => {
    // Arrange
    const suggestedResponse = 'You should configure telemetry exporter and observability pipeline first.';
    const repositoryReadme =
      'Project setup includes telemetry exporter wiring and observability pipeline configuration.';

    // Act
    const result = detectRepositoryContextUsageInResponse({
      suggestedResponse,
      repositoryReadme,
    });

    // Assert
    expect(result).toBe(true);
  });

  it('should not detect repository context usage when readme is empty', () => {
    // Arrange
    const suggestedResponse = 'Run npm install and start the API service.';

    // Act
    const result = detectRepositoryContextUsageInResponse({
      suggestedResponse,
      repositoryReadme: '   ',
    });

    // Assert
    expect(result).toBe(false);
  });

  it('should not detect repository context usage with low token overlap', () => {
    // Arrange
    const suggestedResponse = 'Configure Docker and run migration scripts.';
    const repositoryReadme = 'This service validates issue templates and triages labels automatically.';

    // Act
    const result = detectRepositoryContextUsageInResponse({
      suggestedResponse,
      repositoryReadme,
    });

    // Assert
    expect(result).toBe(false);
  });

  it('should normalize suggested response by trimming non-empty text', () => {
    // Arrange
    const suggestedResponse = '  Use pnpm install and run tests.  ';

    // Act
    const result = normalizeIssueQuestionSuggestedResponse(suggestedResponse);

    // Assert
    expect(result).toBe('Use pnpm install and run tests.');
  });

  it('should normalize suggested response to empty string when undefined or blank', () => {
    // Arrange
    const undefinedSuggestedResponse = undefined;
    const blankSuggestedResponse = '   ';

    // Act
    const undefinedResult = normalizeIssueQuestionSuggestedResponse(undefinedSuggestedResponse);
    const blankResult = normalizeIssueQuestionSuggestedResponse(blankSuggestedResponse);

    // Assert
    expect(undefinedResult).toBe('');
    expect(blankResult).toBe('');
  });

  it('should normalize suggested response value from string arrays and ignore non-string values', () => {
    // Arrange
    const suggestedResponseValue: unknown = ['  Step 1  ', 12, 'Step 2', '', null];

    // Act
    const result = normalizeIssueQuestionSuggestedResponseValue(suggestedResponseValue);

    // Assert
    expect(result).toBe('Step 1\nStep 2');
  });

  it('should build fallback response by joining checklist lines with line breaks', () => {
    // Arrange
    const checklistLines = ['- Confirm Node version', '- Install dependencies', '- Run tests'];

    // Act
    const result = buildIssueQuestionFallbackResponse(checklistLines);

    // Assert
    expect(result).toBe('- Confirm Node version\n- Install dependencies\n- Run tests');
  });

  it('should only build fallback response when issue looks like a question', () => {
    // Arrange
    const checklistLines = ['- Confirm Node version', '- Install dependencies'];

    // Act
    const fallbackForQuestion = buildIssueQuestionFallbackResponseWhenApplicable({
      looksLikeQuestionIssue: true,
      checklistLines,
    });
    const fallbackForNonQuestion = buildIssueQuestionFallbackResponseWhenApplicable({
      looksLikeQuestionIssue: false,
      checklistLines,
    });

    // Assert
    expect(fallbackForQuestion).toBe('- Confirm Node version\n- Install dependencies');
    expect(fallbackForNonQuestion).toBe('');
  });

  it('should resolve response comment prefix and build question response comment body', () => {
    // Arrange
    const commentPrefix = resolveIssueQuestionResponseCommentPrefix({
      responseSource: 'fallback_checklist',
      aiSuggestedResponseCommentPrefix: '[AI]',
      fallbackChecklistCommentPrefix: '[Fallback]',
    });

    // Act
    const result = buildIssueQuestionResponseComment({
      commentPrefix,
      responseBody: 'Use the setup checklist first.',
    });

    // Assert
    expect(result).toBe('[Fallback]\n\nUse the setup checklist first.');
  });

  it('should prepare question response comment only when decision contains response source and body', () => {
    // Arrange
    const validDecision = {
      shouldCreateComment: true,
      responseSource: 'ai_suggested_response' as const,
      responseBody: 'Use pnpm install',
    };
    const invalidDecision = {
      shouldCreateComment: false,
      responseSource: null,
      responseBody: '',
    };

    // Act
    const shouldPrepareValidDecision = shouldPrepareIssueQuestionResponseComment(validDecision);
    const shouldPrepareInvalidDecision = shouldPrepareIssueQuestionResponseComment(invalidDecision);

    // Assert
    expect(shouldPrepareValidDecision).toBe(true);
    expect(shouldPrepareInvalidDecision).toBe(false);
  });

  it('should publish question response comment only when there is no existing comment', () => {
    // Arrange
    const existingCommentInput = { hasExistingQuestionReplyComment: true };
    const missingCommentInput = { hasExistingQuestionReplyComment: false };

    // Act
    const shouldPublishWithExistingComment = shouldPublishIssueQuestionResponseComment(existingCommentInput);
    const shouldPublishWithoutExistingComment = shouldPublishIssueQuestionResponseComment(missingCommentInput);

    // Assert
    expect(shouldPublishWithExistingComment).toBe(false);
    expect(shouldPublishWithoutExistingComment).toBe(true);
  });

  it('should plan question response publication metadata for ai suggested response', () => {
    // Arrange
    const decision = {
      shouldCreateComment: true as const,
      responseSource: 'ai_suggested_response' as const,
      responseBody: 'Use the telemetry exporter setup from README.',
    };

    // Act
    const result = planIssueQuestionResponseCommentPublication({
      decision,
      repositoryReadme: 'The telemetry exporter setup is documented here.',
      aiSuggestedResponseCommentPrefix: '[AI]',
      fallbackChecklistCommentPrefix: '[Fallback]',
    });

    // Assert
    expect(result).toEqual({
      responseSource: 'ai_suggested_response',
      responseBody: 'Use the telemetry exporter setup from README.',
      commentPrefix: '[AI]',
      usedRepositoryContext: true,
    });
  });

  it('should skip question comment publication when publication plan is null', () => {
    // Arrange
    const input = {
      publicationPlan: null,
      hasExistingQuestionReplyComment: false,
    };

    // Act
    const result = decideIssueQuestionResponseCommentPublication(input);

    // Assert
    expect(result).toEqual({
      shouldCreateComment: false,
      commentBody: null,
      skipReason: 'missing_publication_plan',
    });
  });

  it('should skip publication preparation when publication plan is missing', () => {
    // Arrange
    const input = {
      publicationPlan: null,
    };

    // Act
    const result = decideIssueQuestionResponseCommentPublicationPreparation(input);

    // Assert
    expect(result).toEqual({
      shouldCheckExistingQuestionReplyComment: false,
      publicationPlan: null,
      responseSource: null,
      usedRepositoryContext: null,
      skipReason: 'missing_publication_plan',
    });
  });

  it('should prepare publication when publication plan is available', () => {
    // Arrange
    const input = {
      publicationPlan: {
        responseSource: 'fallback_checklist' as const,
        responseBody: '- Share logs',
        commentPrefix: '[Fallback]',
        usedRepositoryContext: false,
      },
    };

    // Act
    const result = decideIssueQuestionResponseCommentPublicationPreparation(input);

    // Assert
    expect(result).toEqual({
      shouldCheckExistingQuestionReplyComment: true,
      publicationPlan: {
        responseSource: 'fallback_checklist',
        responseBody: '- Share logs',
        commentPrefix: '[Fallback]',
        usedRepositoryContext: false,
      },
      responseSource: 'fallback_checklist',
      usedRepositoryContext: false,
      skipReason: null,
    });
  });

  it('should skip question comment publication when comment already exists', () => {
    // Arrange
    const input = {
      publicationPlan: {
        responseSource: 'ai_suggested_response' as const,
        responseBody: 'Use pnpm install',
        commentPrefix: '[AI]',
        usedRepositoryContext: false,
      },
      hasExistingQuestionReplyComment: true,
    };

    // Act
    const result = decideIssueQuestionResponseCommentPublication(input);

    // Assert
    expect(result).toEqual({
      shouldCreateComment: false,
      commentBody: null,
      skipReason: 'question_reply_comment_already_exists',
    });
  });

  it('should publish question comment when plan exists and no previous comment is found', () => {
    // Arrange
    const input = {
      publicationPlan: {
        responseSource: 'fallback_checklist' as const,
        responseBody: '- Share logs',
        commentPrefix: '[Fallback]',
        usedRepositoryContext: false,
      },
      hasExistingQuestionReplyComment: false,
    };

    // Act
    const result = decideIssueQuestionResponseCommentPublication(input);

    // Assert
    expect(result).toEqual({
      shouldCreateComment: true,
      commentBody: '[Fallback]\n\n- Share logs',
      skipReason: null,
    });
  });
});
