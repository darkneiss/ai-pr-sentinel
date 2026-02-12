import {
  decideIssueAiTriageActionProcessing,
  decideIssueAiTriageFailOpenResult,
  decideIssueAiTriageParsingResult,
} from '../../../../src/features/triage/domain/services/issue-ai-triage-processing-policy.service';

describe('IssueAiTriageProcessingPolicyService', () => {
  it('should skip ai triage when action is not supported', () => {
    // Arrange
    const action = 'deleted';

    // Act
    const result = decideIssueAiTriageActionProcessing(action);

    // Assert
    expect(result).toEqual({ status: 'skipped', reason: 'unsupported_action' });
  });

  it('should continue ai triage when action is supported', () => {
    // Arrange
    const action = 'opened';

    // Act
    const result = decideIssueAiTriageActionProcessing(action);

    // Assert
    expect(result).toBeNull();
  });

  it('should fail-open when ai analysis parsing is not possible', () => {
    // Arrange
    const hasParsedAiAnalysis = false;

    // Act
    const result = decideIssueAiTriageParsingResult(hasParsedAiAnalysis);

    // Assert
    expect(result).toEqual({ status: 'skipped', reason: 'ai_unavailable' });
  });

  it('should complete ai triage when ai analysis parsing succeeds', () => {
    // Arrange
    const hasParsedAiAnalysis = true;

    // Act
    const result = decideIssueAiTriageParsingResult(hasParsedAiAnalysis);

    // Assert
    expect(result).toEqual({ status: 'completed' });
  });

  it('should return fail-open result for unhandled ai processing failures', () => {
    // Arrange
    // No setup required.

    // Act
    const result = decideIssueAiTriageFailOpenResult();

    // Assert
    expect(result).toEqual({ status: 'skipped', reason: 'ai_unavailable' });
  });
});
