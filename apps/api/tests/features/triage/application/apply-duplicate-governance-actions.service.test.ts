import { applyDuplicateGovernanceActions } from '../../../../src/features/triage/application/services/apply-duplicate-governance-actions.service';
import type { AiTriageGovernanceActionsExecutionContext } from '../../../../src/features/triage/application/services/ai-triage-governance-actions-context.service';
import {
  decideIssueDuplicateActions,
  resolveFallbackDuplicateIssueNumber,
  shouldProcessIssueDuplicateSignal,
} from '../../../../src/features/triage/domain/services/issue-duplicate-policy.service';
import type { RecentIssueSummary } from '../../../../src/features/triage/application/ports/issue-history-gateway.port';

jest.mock('../../../../src/features/triage/domain/services/issue-duplicate-policy.service', () => ({
  buildIssueDuplicateComment: jest.fn(),
  decideIssueDuplicateActions: jest.fn(),
  resolveFallbackDuplicateIssueNumber: jest.fn(),
  shouldProcessIssueDuplicateSignal: jest.fn(() => true),
}));

const mockedDecideIssueDuplicateActions = decideIssueDuplicateActions as jest.MockedFunction<
  typeof decideIssueDuplicateActions
>;
const mockedResolveFallbackDuplicateIssueNumber = resolveFallbackDuplicateIssueNumber as jest.MockedFunction<
  typeof resolveFallbackDuplicateIssueNumber
>;
const mockedShouldProcessIssueDuplicateSignal = shouldProcessIssueDuplicateSignal as jest.MockedFunction<
  typeof shouldProcessIssueDuplicateSignal
>;

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

  it('should exit early when duplicate decision resolves a null original issue number', async () => {
    // Arrange
    const context = createExecutionContext();
    mockedResolveFallbackDuplicateIssueNumber.mockReturnValue(10);
    mockedDecideIssueDuplicateActions.mockReturnValue({
      shouldApplyDuplicateActions: true,
      resolvedOriginalIssueNumber: null,
      hasSimilarityScore: true,
      hasValidOriginalIssue: true,
      usedFallbackOriginalIssue: false,
    });

    // Act
    await applyDuplicateGovernanceActions(context);

    // Assert
    expect(mockedShouldProcessIssueDuplicateSignal).toHaveBeenCalledTimes(1);
    expect(mockedResolveFallbackDuplicateIssueNumber).toHaveBeenCalledTimes(1);
    expect(mockedDecideIssueDuplicateActions).toHaveBeenCalledTimes(1);
    expect(context.addLabelIfMissing).not.toHaveBeenCalled();
    expect(context.governanceGateway.createComment).not.toHaveBeenCalled();
    expect(context.incrementActionsAppliedCount).not.toHaveBeenCalled();
  });
});
