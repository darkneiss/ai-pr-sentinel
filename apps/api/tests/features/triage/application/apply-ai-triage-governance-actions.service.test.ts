import { applyAiTriageGovernanceActions } from '../../../../src/features/triage/application/services/apply-ai-triage-governance-actions.service';
import { buildIssueAiTriageActionPlan } from '../../../../src/features/triage/domain/services/issue-ai-triage-action-plan.service';
import { applyClassificationGovernanceActions } from '../../../../src/features/triage/application/services/apply-classification-governance-actions.service';
import { applyDuplicateGovernanceActions } from '../../../../src/features/triage/application/services/apply-duplicate-governance-actions.service';
import { applyQuestionResponseGovernanceActions } from '../../../../src/features/triage/application/services/apply-question-response-governance-actions.service';
import type { ApplyAiTriageGovernanceActionsInput } from '../../../../src/features/triage/application/services/ai-triage-governance-actions-context.service';

jest.mock('../../../../src/features/triage/domain/services/issue-ai-triage-action-plan.service', () => ({
  buildIssueAiTriageActionPlan: jest.fn(),
}));

jest.mock('../../../../src/features/triage/application/services/apply-classification-governance-actions.service', () => ({
  applyClassificationGovernanceActions: jest.fn(async () => undefined),
}));

jest.mock('../../../../src/features/triage/application/services/apply-duplicate-governance-actions.service', () => ({
  applyDuplicateGovernanceActions: jest.fn(async () => undefined),
}));

jest.mock(
  '../../../../src/features/triage/application/services/apply-question-response-governance-actions.service',
  () => ({
    applyQuestionResponseGovernanceActions: jest.fn(async () => undefined),
  }),
);

const mockedBuildIssueAiTriageActionPlan = buildIssueAiTriageActionPlan as jest.MockedFunction<
  typeof buildIssueAiTriageActionPlan
>;
const mockedApplyClassificationGovernanceActions = applyClassificationGovernanceActions as jest.MockedFunction<
  typeof applyClassificationGovernanceActions
>;
const mockedApplyDuplicateGovernanceActions = applyDuplicateGovernanceActions as jest.MockedFunction<
  typeof applyDuplicateGovernanceActions
>;
const mockedApplyQuestionResponseGovernanceActions = applyQuestionResponseGovernanceActions as jest.MockedFunction<
  typeof applyQuestionResponseGovernanceActions
>;

const createInput = (): ApplyAiTriageGovernanceActionsInput => ({
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
      reasoning: 'classification',
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
      reasoning: 'tone',
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
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
});

describe('applyAiTriageGovernanceActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should pass direct domain plan slices to downstream governance action services', async () => {
    // Arrange
    const input = createInput();
    const duplicatePlan = {
      shouldProcessSignal: true,
      decision: {
        shouldApplyDuplicateActions: false,
        resolvedOriginalIssueNumber: null,
        hasSimilarityScore: false,
        hasValidOriginalIssue: false,
        usedFallbackOriginalIssue: false,
      },
      commentPublicationPlan: null,
      execution: {
        shouldApplyDuplicateLabel: false,
        commentBody: null,
        skipReason: 'decision_not_actionable',
      } as const,
    };
    const questionPlan = {
      decision: {
        shouldCreateComment: false,
        responseSource: null,
        responseBody: '',
      },
      commentPublicationPlan: null,
      publicationPreparation: {
        shouldCheckExistingQuestionReplyComment: false as const,
        historyLookupBodyPrefix: null,
        publicationPlan: null,
        responseSource: null,
        usedRepositoryContext: null,
        skipReason: 'missing_publication_plan' as const,
      },
    };
    mockedBuildIssueAiTriageActionPlan.mockReturnValue({
      effectiveTone: 'neutral',
      classification: {
        labelsToAdd: [],
        labelsToRemove: [],
        wasSuppressedByHostileTone: false,
      },
      duplicate: duplicatePlan,
      question: questionPlan,
      tone: {
        labelsToAdd: [],
      },
    });

    // Act
    await applyAiTriageGovernanceActions(input);

    // Assert
    expect(mockedApplyClassificationGovernanceActions).toHaveBeenCalledTimes(1);
    expect(mockedApplyDuplicateGovernanceActions).toHaveBeenCalledTimes(1);
    expect(mockedApplyQuestionResponseGovernanceActions).toHaveBeenCalledTimes(1);
    expect(mockedApplyDuplicateGovernanceActions.mock.calls[0]?.[1]).toBe(duplicatePlan);
    expect(mockedApplyQuestionResponseGovernanceActions.mock.calls[0]?.[1]).toBe(questionPlan);
  });
});
