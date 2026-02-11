import {
  buildIssueDuplicateComment,
  decideIssueDuplicateActions,
  resolveFallbackDuplicateIssueNumber,
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
});
