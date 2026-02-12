import {
  decideIssueKindSuppressionLogDecision,
  decideIssueKindLabelActions,
  planIssueKindLabelActions,
  resolveIssueKindLabel,
} from '../../../../src/features/triage/domain/services/issue-kind-label-policy.service';

const AI_KIND_LABELS = ['kind/bug', 'kind/feature', 'kind/question'] as const;

describe('IssueKindLabelPolicyService', () => {
  it('should remove all kind labels when hostile sentiment is confident', () => {
    // Arrange
    const existingLabels = ['kind/bug', 'kind/feature'];

    // Act
    const result = decideIssueKindLabelActions({
      targetKindLabel: 'kind/question',
      classificationConfidence: 0.99,
      classificationConfidenceThreshold: 0.8,
      sentimentTone: 'hostile',
      sentimentConfidence: 0.95,
      sentimentConfidenceThreshold: 0.8,
      existingLabels,
      kindLabels: [...AI_KIND_LABELS],
    });

    // Assert
    expect(result).toEqual({
      labelsToAdd: [],
      labelsToRemove: ['kind/bug', 'kind/feature'],
      wasSuppressedByHostileTone: true,
    });
  });

  it('should relabel kind when classification confidence is high and tone is not suppressed', () => {
    // Arrange
    const existingLabels = ['kind/bug'];

    // Act
    const result = decideIssueKindLabelActions({
      targetKindLabel: 'kind/question',
      classificationConfidence: 0.95,
      classificationConfidenceThreshold: 0.8,
      sentimentTone: 'neutral',
      sentimentConfidence: 0.5,
      sentimentConfidenceThreshold: 0.8,
      existingLabels,
      kindLabels: [...AI_KIND_LABELS],
    });

    // Assert
    expect(result).toEqual({
      labelsToAdd: ['kind/question'],
      labelsToRemove: ['kind/bug'],
      wasSuppressedByHostileTone: false,
    });
  });

  it('should not add target kind label when it is already present', () => {
    // Arrange
    const existingLabels = ['kind/question'];

    // Act
    const result = decideIssueKindLabelActions({
      targetKindLabel: 'kind/question',
      classificationConfidence: 0.95,
      classificationConfidenceThreshold: 0.8,
      sentimentTone: 'neutral',
      sentimentConfidence: 0.5,
      sentimentConfidenceThreshold: 0.8,
      existingLabels,
      kindLabels: [...AI_KIND_LABELS],
    });

    // Assert
    expect(result).toEqual({
      labelsToAdd: [],
      labelsToRemove: [],
      wasSuppressedByHostileTone: false,
    });
  });

  it('should not change kind labels when classification confidence is below threshold', () => {
    // Arrange
    const existingLabels = ['kind/bug'];

    // Act
    const result = decideIssueKindLabelActions({
      targetKindLabel: 'kind/question',
      classificationConfidence: 0.4,
      classificationConfidenceThreshold: 0.8,
      sentimentTone: 'neutral',
      sentimentConfidence: 0.5,
      sentimentConfidenceThreshold: 0.8,
      existingLabels,
      kindLabels: [...AI_KIND_LABELS],
    });

    // Assert
    expect(result).toEqual({
      labelsToAdd: [],
      labelsToRemove: [],
      wasSuppressedByHostileTone: false,
    });
  });

  it('should resolve kind label for issue classification type', () => {
    // Arrange
    const input = {
      issueKind: 'feature' as const,
      bugLabel: 'kind/bug',
      featureLabel: 'kind/feature',
      questionLabel: 'kind/question',
    };

    // Act
    const result = resolveIssueKindLabel(input);

    // Assert
    expect(result).toBe('kind/feature');
  });

  it('should plan kind label actions from issue kind and policy thresholds', () => {
    // Arrange
    const input = {
      issueKind: 'feature' as const,
      bugLabel: 'kind/bug',
      featureLabel: 'kind/feature',
      questionLabel: 'kind/question',
      classificationConfidence: 0.9,
      classificationConfidenceThreshold: 0.8,
      sentimentTone: 'neutral' as const,
      sentimentConfidence: 0.6,
      sentimentConfidenceThreshold: 0.8,
      existingLabels: ['kind/bug'],
      kindLabels: [...AI_KIND_LABELS],
    };

    // Act
    const result = planIssueKindLabelActions(input);

    // Assert
    expect(result).toEqual({
      labelsToAdd: ['kind/feature'],
      labelsToRemove: ['kind/bug'],
      wasSuppressedByHostileTone: false,
    });
  });

  it('should decide suppression log emission when kind labels were suppressed', () => {
    // Arrange
    const input = {
      wasSuppressedByHostileTone: true,
    };

    // Act
    const result = decideIssueKindSuppressionLogDecision(input);

    // Assert
    expect(result).toEqual({
      shouldLogSuppression: true,
      skipReason: null,
    });
  });

  it('should skip suppression log emission when no suppression happened', () => {
    // Arrange
    const input = {
      wasSuppressedByHostileTone: false,
    };

    // Act
    const result = decideIssueKindSuppressionLogDecision(input);

    // Assert
    expect(result).toEqual({
      shouldLogSuppression: false,
      skipReason: 'not_suppressed',
    });
  });
});
