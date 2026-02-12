import { applyClassificationGovernanceActions } from '../../../../src/features/triage/application/services/apply-classification-governance-actions.service';
import type { AiTriageGovernanceActionsExecutionContext } from '../../../../src/features/triage/application/services/ai-triage-governance-actions-context.service';
import type { IssueKindLabelActionsDecision } from '../../../../src/features/triage/domain/services/issue-kind-label-policy.service';

const createExecutionContext = (): AiTriageGovernanceActionsExecutionContext => ({
  action: 'opened',
  repositoryFullName: 'org/repo',
  issue: {
    number: 42,
    title: 'Issue title',
    body: 'Issue body',
    labels: ['kind/bug'],
  },
  aiAnalysis: {
    classification: {
      type: 'question',
      confidence: 0.95,
      reasoning: 'question intent',
    },
    duplicateDetection: {
      isDuplicate: false,
      originalIssueNumber: null,
      similarityScore: 0.1,
      hasExplicitOriginalIssueReference: false,
    },
    sentiment: {
      tone: 'neutral',
      confidence: 0.8,
      reasoning: 'neutral',
    },
    suggestedResponse: undefined,
  },
  llmProvider: 'ollama',
  llmModel: 'mock-model',
  governanceGateway: {
    addLabels: jest.fn(async () => undefined),
    removeLabel: jest.fn(async () => undefined),
    createComment: jest.fn(async () => undefined),
    logValidatedIssue: jest.fn(async () => undefined),
  },
  issueHistoryGateway: {
    findRecentIssues: jest.fn(async () => []),
    hasIssueCommentWithPrefix: jest.fn(async () => false),
  },
  recentIssues: [],
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
  issueLabels: new Set<string>(['kind/bug']),
  effectiveTone: 'neutral',
  actionsAppliedCount: 0,
  addLabelIfMissing: jest.fn(async () => true),
  removeLabelIfPresent: jest.fn(async () => undefined),
  incrementActionsAppliedCount: jest.fn(),
});

describe('applyClassificationGovernanceActions', () => {
  it('should fail fast when classification plan is missing', async () => {
    // Arrange
    const context = createExecutionContext();

    // Act
    const result = applyClassificationGovernanceActions(
      context,
      undefined as unknown as IssueKindLabelActionsDecision,
    );

    // Assert
    await expect(result).rejects.toThrow('Classification action plan is required.');
  });

  it('should use precomputed classification decision when provided', async () => {
    // Arrange
    const context = createExecutionContext();
    const precomputedDecision: IssueKindLabelActionsDecision = {
      labelsToAdd: ['kind/feature'],
      labelsToRemove: ['kind/bug'],
      wasSuppressedByHostileTone: false,
    };

    // Act
    await applyClassificationGovernanceActions(context, precomputedDecision);

    // Assert
    expect(context.removeLabelIfPresent).toHaveBeenCalledWith('kind/bug');
    expect(context.addLabelIfMissing).toHaveBeenCalledWith('kind/feature');
  });
});
