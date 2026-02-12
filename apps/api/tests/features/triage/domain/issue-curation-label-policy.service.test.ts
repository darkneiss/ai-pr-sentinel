import { planIssueCurationLabels } from '../../../../src/features/triage/domain/services/issue-curation-label-policy.service';

describe('IssueCurationLabelPolicyService', () => {
  it('should add configured curation labels when AI recommendations are high confidence', () => {
    // Arrange
    const input = {
      labelRecommendations: {
        documentation: { shouldApply: true, confidence: 0.95, reasoning: 'Documentation request.' },
        helpWanted: { shouldApply: true, confidence: 0.92, reasoning: 'Contributor support needed.' },
        goodFirstIssue: { shouldApply: true, confidence: 0.98, reasoning: 'Suitable for new contributors.' },
      },
      existingLabels: [],
      documentationLabel: 'documentation',
      helpWantedLabel: 'help wanted',
      goodFirstIssueLabel: 'good first issue',
      documentationConfidenceThreshold: 0.9,
      helpWantedConfidenceThreshold: 0.9,
      goodFirstIssueConfidenceThreshold: 0.95,
      classificationType: 'feature' as const,
      classificationConfidence: 0.91,
      classificationConfidenceThreshold: 0.8,
      sentimentTone: 'neutral' as const,
      isLikelyDuplicate: false,
    };

    // Act
    const result = planIssueCurationLabels(input);

    // Assert
    expect(result.labelsToAdd).toEqual(['documentation', 'help wanted', 'good first issue']);
  });

  it('should skip curation labels for hostile tone or likely duplicate', () => {
    // Arrange
    const hostileInput = {
      labelRecommendations: {
        documentation: { shouldApply: true, confidence: 0.95 },
      },
      existingLabels: [],
      documentationLabel: 'documentation',
      helpWantedLabel: 'help wanted',
      goodFirstIssueLabel: 'good first issue',
      documentationConfidenceThreshold: 0.9,
      helpWantedConfidenceThreshold: 0.9,
      goodFirstIssueConfidenceThreshold: 0.95,
      classificationType: 'feature' as const,
      classificationConfidence: 0.95,
      classificationConfidenceThreshold: 0.8,
      sentimentTone: 'hostile' as const,
      isLikelyDuplicate: false,
    };

    const duplicateInput = {
      ...hostileInput,
      sentimentTone: 'neutral' as const,
      isLikelyDuplicate: true,
    };

    // Act
    const hostileResult = planIssueCurationLabels(hostileInput);
    const duplicateResult = planIssueCurationLabels(duplicateInput);

    // Assert
    expect(hostileResult.labelsToAdd).toEqual([]);
    expect(duplicateResult.labelsToAdd).toEqual([]);
  });

  it('should skip low-confidence or already-present curation labels', () => {
    // Arrange
    const input = {
      labelRecommendations: {
        documentation: { shouldApply: true, confidence: 0.7 },
        helpWanted: { shouldApply: true, confidence: 0.95 },
      },
      existingLabels: ['help wanted'],
      documentationLabel: 'documentation',
      helpWantedLabel: 'help wanted',
      goodFirstIssueLabel: 'good first issue',
      documentationConfidenceThreshold: 0.9,
      helpWantedConfidenceThreshold: 0.9,
      goodFirstIssueConfidenceThreshold: 0.95,
      classificationType: 'question' as const,
      classificationConfidence: 0.9,
      classificationConfidenceThreshold: 0.8,
      sentimentTone: 'neutral' as const,
      isLikelyDuplicate: false,
    };

    // Act
    const result = planIssueCurationLabels(input);

    // Assert
    expect(result.labelsToAdd).toEqual([]);
  });
});
