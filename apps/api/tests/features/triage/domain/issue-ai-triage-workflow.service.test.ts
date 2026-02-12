import type { AiAnalysis } from '../../../../src/features/triage/domain/services/issue-ai-analysis.types';
import {
  decideIssueAiTriageWorkflowAfterLlm,
  decideIssueAiTriageWorkflowOnStart,
  decideIssueAiTriageWorkflowOnUnhandledFailure,
} from '../../../../src/features/triage/domain/services/issue-ai-triage-workflow.service';

const createAiAnalysis = (): AiAnalysis => ({
  classification: {
    type: 'bug',
    confidence: 0.95,
    reasoning: 'bug reasoning',
  },
  duplicateDetection: {
    isDuplicate: false,
    originalIssueNumber: null,
    similarityScore: 0.1,
  },
  sentiment: {
    tone: 'neutral',
    confidence: 0.5,
    reasoning: 'sentiment reasoning',
  },
});

describe('IssueAiTriageWorkflowService', () => {
  it('should skip workflow start for unsupported action', () => {
    // Arrange
    const action = 'deleted';

    // Act
    const result = decideIssueAiTriageWorkflowOnStart(action);

    // Assert
    expect(result).toEqual({
      shouldContinue: false,
      result: {
        status: 'skipped',
        reason: 'unsupported_action',
      },
    });
  });

  it('should continue workflow start for supported action', () => {
    // Arrange
    const action = 'opened';

    // Act
    const result = decideIssueAiTriageWorkflowOnStart(action);

    // Assert
    expect(result).toEqual({
      shouldContinue: true,
      result: null,
    });
  });

  it('should fail-open when parsed AI analysis is missing', () => {
    // Arrange
    const aiAnalysis = undefined;

    // Act
    const result = decideIssueAiTriageWorkflowAfterLlm(aiAnalysis);

    // Assert
    expect(result).toEqual({
      shouldApplyGovernanceActions: false,
      aiAnalysis: null,
      result: {
        status: 'skipped',
        reason: 'ai_unavailable',
      },
    });
  });

  it('should continue governance execution when parsed AI analysis exists', () => {
    // Arrange
    const aiAnalysis = createAiAnalysis();

    // Act
    const result = decideIssueAiTriageWorkflowAfterLlm(aiAnalysis);

    // Assert
    expect(result).toEqual({
      shouldApplyGovernanceActions: true,
      aiAnalysis,
      result: {
        status: 'completed',
      },
    });
  });

  it('should return fail-open result for unhandled workflow failure', () => {
    // Arrange
    // No setup required.

    // Act
    const result = decideIssueAiTriageWorkflowOnUnhandledFailure();

    // Assert
    expect(result).toEqual({
      status: 'skipped',
      reason: 'ai_unavailable',
    });
  });
});
