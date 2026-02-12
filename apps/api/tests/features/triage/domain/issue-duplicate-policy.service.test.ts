import {
  buildIssueDuplicateComment,
  decideIssueDuplicateGovernanceExecution,
  decideIssueDuplicateActions,
  planIssueDuplicateCommentPublication,
  resolveFallbackDuplicateIssueNumber,
  shouldProcessIssueDuplicateSignal,
} from '../../../../src/features/triage/domain/services/issue-duplicate-policy.service';

describe('IssueDuplicatePolicyService', () => {
  it('should skip duplicate actions when AI does not mark issue as duplicate', () => {
    // Arrange
    const input = {
      isDuplicate: false,
      originalIssueNumber: 10,
      similarityScore: 0.95,
      hasExplicitOriginalIssueReference: false,
      currentIssueNumber: 42,
      fallbackOriginalIssueNumber: 55,
      similarityThreshold: 0.85,
    };

    // Act
    const result = decideIssueDuplicateActions(input);

    // Assert
    expect(result).toEqual({
      shouldApplyDuplicateActions: false,
      resolvedOriginalIssueNumber: 10,
      hasSimilarityScore: true,
      hasValidOriginalIssue: true,
      usedFallbackOriginalIssue: false,
    });
  });

  it('should apply duplicate actions when confidence and original issue are valid', () => {
    // Arrange
    const input = {
      isDuplicate: true,
      originalIssueNumber: 10,
      similarityScore: 0.95,
      hasExplicitOriginalIssueReference: false,
      currentIssueNumber: 42,
      fallbackOriginalIssueNumber: null,
      similarityThreshold: 0.85,
    };

    // Act
    const result = decideIssueDuplicateActions(input);

    // Assert
    expect(result).toEqual({
      shouldApplyDuplicateActions: true,
      resolvedOriginalIssueNumber: 10,
      hasSimilarityScore: true,
      hasValidOriginalIssue: true,
      usedFallbackOriginalIssue: false,
    });
  });

  it('should fallback to recent issue when AI omits original issue without explicit reference', () => {
    // Arrange
    const input = {
      isDuplicate: true,
      originalIssueNumber: null,
      similarityScore: 0.95,
      hasExplicitOriginalIssueReference: false,
      currentIssueNumber: 42,
      fallbackOriginalIssueNumber: 55,
      similarityThreshold: 0.85,
    };

    // Act
    const result = decideIssueDuplicateActions(input);

    // Assert
    expect(result).toEqual({
      shouldApplyDuplicateActions: true,
      resolvedOriginalIssueNumber: 55,
      hasSimilarityScore: true,
      hasValidOriginalIssue: true,
      usedFallbackOriginalIssue: true,
    });
  });

  it('should not fallback when AI explicitly references but fails to provide original issue', () => {
    // Arrange
    const input = {
      isDuplicate: true,
      originalIssueNumber: null,
      similarityScore: 0.95,
      hasExplicitOriginalIssueReference: true,
      currentIssueNumber: 42,
      fallbackOriginalIssueNumber: 55,
      similarityThreshold: 0.85,
    };

    // Act
    const result = decideIssueDuplicateActions(input);

    // Assert
    expect(result).toEqual({
      shouldApplyDuplicateActions: false,
      resolvedOriginalIssueNumber: null,
      hasSimilarityScore: true,
      hasValidOriginalIssue: false,
      usedFallbackOriginalIssue: false,
    });
  });

  it('should skip duplicate actions when similarity score is below threshold', () => {
    // Arrange
    const input = {
      isDuplicate: true,
      originalIssueNumber: 10,
      similarityScore: 0.6,
      hasExplicitOriginalIssueReference: false,
      currentIssueNumber: 42,
      fallbackOriginalIssueNumber: null,
      similarityThreshold: 0.85,
    };

    // Act
    const result = decideIssueDuplicateActions(input);

    // Assert
    expect(result).toEqual({
      shouldApplyDuplicateActions: false,
      resolvedOriginalIssueNumber: 10,
      hasSimilarityScore: false,
      hasValidOriginalIssue: true,
      usedFallbackOriginalIssue: false,
    });
  });

  it('should resolve fallback duplicate issue number using first non-current issue', () => {
    // Arrange
    const input = {
      currentIssueNumber: 42,
      recentIssueNumbers: [42, 21, 33],
    };

    // Act
    const result = resolveFallbackDuplicateIssueNumber(input);

    // Assert
    expect(result).toBe(21);
  });

  it('should return null when all recent issues are the current issue', () => {
    // Arrange
    const input = {
      currentIssueNumber: 42,
      recentIssueNumbers: [42, 42],
    };

    // Act
    const result = resolveFallbackDuplicateIssueNumber(input);

    // Assert
    expect(result).toBeNull();
  });

  it('should return null when recent issues are empty', () => {
    // Arrange
    const input = {
      currentIssueNumber: 42,
      recentIssueNumbers: [],
    };

    // Act
    const result = resolveFallbackDuplicateIssueNumber(input);

    // Assert
    expect(result).toBeNull();
  });

  it('should build duplicate comment message with rounded similarity percentage', () => {
    // Arrange
    const input = {
      commentPrefix: 'Possible duplicate of #',
      originalIssueNumber: 123,
      similarityScore: 0.914,
    };

    // Act
    const result = buildIssueDuplicateComment(input);

    // Assert
    expect(result).toBe('Possible duplicate of #123 (Similarity: 91%).');
  });

  it('should process duplicate actions only when ai marks issue as duplicate', () => {
    // Arrange
    const duplicateSignalInput = { isDuplicate: true };
    const nonDuplicateSignalInput = { isDuplicate: false };

    // Act
    const shouldProcessDuplicateSignal = shouldProcessIssueDuplicateSignal(duplicateSignalInput);
    const shouldProcessNonDuplicateSignal = shouldProcessIssueDuplicateSignal(nonDuplicateSignalInput);

    // Assert
    expect(shouldProcessDuplicateSignal).toBe(true);
    expect(shouldProcessNonDuplicateSignal).toBe(false);
  });

  it('should plan duplicate comment publication when decision is actionable', () => {
    // Arrange
    const decision = {
      shouldApplyDuplicateActions: true,
      resolvedOriginalIssueNumber: 123,
      hasSimilarityScore: true,
      hasValidOriginalIssue: true,
      usedFallbackOriginalIssue: false,
    };

    // Act
    const result = planIssueDuplicateCommentPublication({
      decision,
      commentPrefix: 'Possible duplicate of #',
      similarityScore: 0.914,
    });

    // Assert
    expect(result).toEqual({
      originalIssueNumber: 123,
      usedFallbackOriginalIssue: false,
      commentBody: 'Possible duplicate of #123 (Similarity: 91%).',
    });
  });

  it('should not plan duplicate comment publication when decision is not actionable', () => {
    // Arrange
    const decision = {
      shouldApplyDuplicateActions: false,
      resolvedOriginalIssueNumber: null,
      hasSimilarityScore: true,
      hasValidOriginalIssue: false,
      usedFallbackOriginalIssue: false,
    };

    // Act
    const result = planIssueDuplicateCommentPublication({
      decision,
      commentPrefix: 'Possible duplicate of #',
      similarityScore: 0.9,
    });

    // Assert
    expect(result).toBeNull();
  });

  it('should skip duplicate governance execution when duplicate signal is disabled', () => {
    // Arrange
    const input = {
      shouldProcessSignal: false,
      decision: {
        shouldApplyDuplicateActions: true,
        resolvedOriginalIssueNumber: 10,
        hasSimilarityScore: true,
        hasValidOriginalIssue: true,
        usedFallbackOriginalIssue: false,
      },
      commentPublicationPlan: {
        originalIssueNumber: 10,
        usedFallbackOriginalIssue: false,
        commentBody: 'Possible duplicate of #10 (Similarity: 90%).',
      },
    };

    // Act
    const result = decideIssueDuplicateGovernanceExecution(input);

    // Assert
    expect(result).toEqual({
      shouldApplyDuplicateLabel: false,
      commentBody: null,
      skipReason: 'signal_not_marked_duplicate',
    });
  });

  it('should skip duplicate governance execution when duplicate decision is not actionable', () => {
    // Arrange
    const input = {
      shouldProcessSignal: true,
      decision: {
        shouldApplyDuplicateActions: false,
        resolvedOriginalIssueNumber: null,
        hasSimilarityScore: true,
        hasValidOriginalIssue: false,
        usedFallbackOriginalIssue: false,
      },
      commentPublicationPlan: null,
    };

    // Act
    const result = decideIssueDuplicateGovernanceExecution(input);

    // Assert
    expect(result).toEqual({
      shouldApplyDuplicateLabel: false,
      commentBody: null,
      skipReason: 'decision_not_actionable',
    });
  });

  it('should skip duplicate governance execution when publication plan is missing', () => {
    // Arrange
    const input = {
      shouldProcessSignal: true,
      decision: {
        shouldApplyDuplicateActions: true,
        resolvedOriginalIssueNumber: 10,
        hasSimilarityScore: true,
        hasValidOriginalIssue: true,
        usedFallbackOriginalIssue: false,
      },
      commentPublicationPlan: null,
    };

    // Act
    const result = decideIssueDuplicateGovernanceExecution(input);

    // Assert
    expect(result).toEqual({
      shouldApplyDuplicateLabel: false,
      commentBody: null,
      skipReason: 'missing_comment_publication_plan',
    });
  });

  it('should mark duplicate governance execution as actionable when all gates pass', () => {
    // Arrange
    const input = {
      shouldProcessSignal: true,
      decision: {
        shouldApplyDuplicateActions: true,
        resolvedOriginalIssueNumber: 10,
        hasSimilarityScore: true,
        hasValidOriginalIssue: true,
        usedFallbackOriginalIssue: false,
      },
      commentPublicationPlan: {
        originalIssueNumber: 10,
        usedFallbackOriginalIssue: false,
        commentBody: 'Possible duplicate of #10 (Similarity: 90%).',
      },
    };

    // Act
    const result = decideIssueDuplicateGovernanceExecution(input);

    // Assert
    expect(result).toEqual({
      shouldApplyDuplicateLabel: true,
      commentBody: 'Possible duplicate of #10 (Similarity: 90%).',
      skipReason: null,
    });
  });
});
