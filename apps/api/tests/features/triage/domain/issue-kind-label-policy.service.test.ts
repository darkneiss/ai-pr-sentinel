import { decideIssueKindLabelActions } from '../../../../src/features/triage/domain/services/issue-kind-label-policy.service';

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
});
