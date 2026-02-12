import { applyDuplicateGovernanceActions } from '../../../../src/features/triage/application/services/apply-duplicate-governance-actions.service';
import type { AiTriageGovernanceActionsExecutionContext } from '../../../../src/features/triage/application/services/ai-triage-governance-actions-context.service';
import type { RecentIssueSummary } from '../../../../src/features/triage/application/ports/issue-history-gateway.port';
import type { DuplicateGovernanceExecutionPlan } from '../../../../src/features/triage/application/services/apply-duplicate-governance-actions.service';

const createExecutionContext = (): AiTriageGovernanceActionsExecutionContext => {
  const recentIssues: RecentIssueSummary[] = [
    {
      number: 10,
      title: 'Existing duplicate',
      labels: [],
      state: 'open',
    },
  ];

  return {
    action: 'opened',
    repositoryFullName: 'org/repo',
    issue: {
      number: 42,
      title: 'Issue title',
      body: 'Issue body',
      labels: [],
    },
    aiAnalysis: {
      classification: {
        type: 'bug',
        confidence: 0.9,
        reasoning: 'classification reasoning',
      },
      duplicateDetection: {
        isDuplicate: true,
        originalIssueNumber: null,
        similarityScore: 0.95,
        hasExplicitOriginalIssueReference: false,
      },
      sentiment: {
        tone: 'neutral',
        confidence: 0.8,
        reasoning: 'tone reasoning',
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
    recentIssues,
    logger: {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    },
    issueLabels: new Set<string>(),
    effectiveTone: 'neutral',
    actionsAppliedCount: 0,
    addLabelIfMissing: jest.fn(async () => true),
    removeLabelIfPresent: jest.fn(async () => undefined),
    incrementActionsAppliedCount: jest.fn(),
  };
};

describe('applyDuplicateGovernanceActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fail fast when duplicate governance execution plan is missing', async () => {
    // Arrange
    const context = createExecutionContext();

    // Act
    const result = applyDuplicateGovernanceActions(
      context,
      undefined as unknown as DuplicateGovernanceExecutionPlan,
    );

    // Assert
    await expect(result).rejects.toThrow('Duplicate action plan is required.');
  });

  it('should exit early when duplicate signal must not be processed', async () => {
    // Arrange
    const context = createExecutionContext();
    const plan: DuplicateGovernanceExecutionPlan = {
      shouldProcessSignal: false,
      duplicateDecision: {
        shouldApplyDuplicateActions: false,
        resolvedOriginalIssueNumber: null,
        hasSimilarityScore: false,
        hasValidOriginalIssue: false,
        usedFallbackOriginalIssue: false,
      },
      duplicateCommentPublicationPlan: null,
    };

    // Act
    await applyDuplicateGovernanceActions(context, plan);

    // Assert
    expect(context.addLabelIfMissing).not.toHaveBeenCalled();
    expect(context.governanceGateway.createComment).not.toHaveBeenCalled();
    expect(context.incrementActionsAppliedCount).not.toHaveBeenCalled();
  });

  it('should skip duplicate actions when decision says not to apply', async () => {
    // Arrange
    const context = createExecutionContext();
    const plan: DuplicateGovernanceExecutionPlan = {
      shouldProcessSignal: true,
      duplicateDecision: {
        shouldApplyDuplicateActions: false,
        resolvedOriginalIssueNumber: 10,
        hasSimilarityScore: true,
        hasValidOriginalIssue: true,
        usedFallbackOriginalIssue: false,
      },
      duplicateCommentPublicationPlan: null,
    };

    // Act
    await applyDuplicateGovernanceActions(context, plan);

    // Assert
    expect(context.addLabelIfMissing).not.toHaveBeenCalled();
    expect(context.governanceGateway.createComment).not.toHaveBeenCalled();
    expect(context.incrementActionsAppliedCount).not.toHaveBeenCalled();
  });

  it('should create duplicate comment when duplicate label is added', async () => {
    // Arrange
    const context = createExecutionContext();
    const plan: DuplicateGovernanceExecutionPlan = {
      shouldProcessSignal: true,
      duplicateDecision: {
        shouldApplyDuplicateActions: true,
        resolvedOriginalIssueNumber: 10,
        hasSimilarityScore: true,
        hasValidOriginalIssue: true,
        usedFallbackOriginalIssue: false,
      },
      duplicateCommentPublicationPlan: {
        originalIssueNumber: 10,
        commentBody: 'AI Triage: Possible duplicate of #10',
        usedFallbackOriginalIssue: false,
      },
    };

    // Act
    await applyDuplicateGovernanceActions(context, plan);

    // Assert
    expect(context.addLabelIfMissing).toHaveBeenCalledWith('triage/duplicate');
    expect(context.governanceGateway.createComment).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      body: 'AI Triage: Possible duplicate of #10',
    });
    expect(context.incrementActionsAppliedCount).toHaveBeenCalledTimes(1);
  });

  it('should skip duplicate comment when duplicate label already exists', async () => {
    // Arrange
    const context = createExecutionContext();
    (context.addLabelIfMissing as jest.MockedFunction<typeof context.addLabelIfMissing>).mockResolvedValue(false);
    const plan: DuplicateGovernanceExecutionPlan = {
      shouldProcessSignal: true,
      duplicateDecision: {
        shouldApplyDuplicateActions: true,
        resolvedOriginalIssueNumber: 10,
        hasSimilarityScore: true,
        hasValidOriginalIssue: true,
        usedFallbackOriginalIssue: false,
      },
      duplicateCommentPublicationPlan: {
        originalIssueNumber: 10,
        commentBody: 'AI Triage: Possible duplicate of #10',
        usedFallbackOriginalIssue: false,
      },
    };

    // Act
    await applyDuplicateGovernanceActions(context, plan);

    // Assert
    expect(context.governanceGateway.createComment).not.toHaveBeenCalled();
    expect(context.incrementActionsAppliedCount).not.toHaveBeenCalled();
  });

  it('should exit early when comment publication plan is null', async () => {
    // Arrange
    const context = createExecutionContext();
    const plan: DuplicateGovernanceExecutionPlan = {
      shouldProcessSignal: true,
      duplicateDecision: {
      shouldApplyDuplicateActions: true,
      resolvedOriginalIssueNumber: 10,
      hasSimilarityScore: true,
      hasValidOriginalIssue: true,
      usedFallbackOriginalIssue: false,
      },
      duplicateCommentPublicationPlan: null,
    };

    // Act
    await applyDuplicateGovernanceActions(context, plan);

    // Assert
    expect(context.addLabelIfMissing).not.toHaveBeenCalled();
    expect(context.governanceGateway.createComment).not.toHaveBeenCalled();
    expect(context.incrementActionsAppliedCount).not.toHaveBeenCalled();
  });
});
