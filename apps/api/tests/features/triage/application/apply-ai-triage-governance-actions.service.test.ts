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
        historyLookupBodyPrefix: 'AI Triage: Suggested',
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
      curation: {
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

  it('should apply planned curation labels after triage orchestration', async () => {
    // Arrange
    const input = createInput();
    mockedBuildIssueAiTriageActionPlan.mockReturnValue({
      effectiveTone: 'neutral',
      classification: {
        labelsToAdd: [],
        labelsToRemove: [],
        wasSuppressedByHostileTone: false,
      },
      duplicate: {
        shouldProcessSignal: false,
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
          skipReason: 'signal_not_marked_duplicate',
        },
      },
      question: {
        decision: {
          shouldCreateComment: false,
          responseSource: null,
          responseBody: '',
        },
        commentPublicationPlan: null,
        publicationPreparation: {
          shouldCheckExistingQuestionReplyComment: false,
          historyLookupBodyPrefix: 'AI Triage: Suggested',
          publicationPlan: null,
          responseSource: null,
          usedRepositoryContext: null,
          skipReason: 'missing_publication_plan',
        },
      },
      tone: {
        labelsToAdd: [],
      },
      curation: {
        labelsToAdd: ['documentation', 'help wanted'],
      },
    });

    // Act
    await applyAiTriageGovernanceActions(input);

    // Assert
    expect(input.governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      labels: ['documentation'],
    });
    expect(input.governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      labels: ['help wanted'],
    });
  });

  it('should pass curation confidence thresholds from env config into action plan', async () => {
    // Arrange
    const input = createInput();
    input.config = {
      get: (key: string) => {
        if (key === 'AI_LABEL_DOCUMENTATION_CONFIDENCE_THRESHOLD') return '0.86';
        if (key === 'AI_LABEL_HELP_WANTED_CONFIDENCE_THRESHOLD') return '0.8';
        if (key === 'AI_LABEL_GOOD_FIRST_ISSUE_CONFIDENCE_THRESHOLD') return '0.93';
        return undefined;
      },
      getBoolean: () => undefined,
    };
    mockedBuildIssueAiTriageActionPlan.mockReturnValue({
      effectiveTone: 'neutral',
      classification: {
        labelsToAdd: [],
        labelsToRemove: [],
        wasSuppressedByHostileTone: false,
      },
      duplicate: {
        shouldProcessSignal: false,
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
          skipReason: 'signal_not_marked_duplicate',
        },
      },
      question: {
        decision: {
          shouldCreateComment: false,
          responseSource: null,
          responseBody: '',
        },
        commentPublicationPlan: null,
        publicationPreparation: {
          shouldCheckExistingQuestionReplyComment: false,
          historyLookupBodyPrefix: 'AI Triage: Suggested',
          publicationPlan: null,
          responseSource: null,
          usedRepositoryContext: null,
          skipReason: 'missing_publication_plan',
        },
      },
      tone: {
        labelsToAdd: [],
      },
      curation: {
        labelsToAdd: [],
      },
    });

    // Act
    await applyAiTriageGovernanceActions(input);

    // Assert
    expect(mockedBuildIssueAiTriageActionPlan).toHaveBeenCalledTimes(1);
    expect(mockedBuildIssueAiTriageActionPlan.mock.calls[0]?.[0].curationPolicy).toEqual({
      documentationLabel: 'documentation',
      helpWantedLabel: 'help wanted',
      goodFirstIssueLabel: 'good first issue',
      documentationConfidenceThreshold: 0.86,
      helpWantedConfidenceThreshold: 0.8,
      goodFirstIssueConfidenceThreshold: 0.93,
    });
  });

  it('should pass core ai decision thresholds from env config into action plan', async () => {
    // Arrange
    const input = createInput();
    input.config = {
      get: (key: string) => {
        if (key === 'AI_CLASSIFICATION_CONFIDENCE_THRESHOLD') return '0.7';
        if (key === 'AI_SENTIMENT_CONFIDENCE_THRESHOLD') return '0.65';
        if (key === 'AI_DUPLICATE_SIMILARITY_THRESHOLD') return '0.88';
        return undefined;
      },
      getBoolean: () => undefined,
    };
    mockedBuildIssueAiTriageActionPlan.mockReturnValue({
      effectiveTone: 'neutral',
      classification: {
        labelsToAdd: [],
        labelsToRemove: [],
        wasSuppressedByHostileTone: false,
      },
      duplicate: {
        shouldProcessSignal: false,
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
          skipReason: 'signal_not_marked_duplicate',
        },
      },
      question: {
        decision: {
          shouldCreateComment: false,
          responseSource: null,
          responseBody: '',
        },
        commentPublicationPlan: null,
        publicationPreparation: {
          shouldCheckExistingQuestionReplyComment: false,
          historyLookupBodyPrefix: 'AI Triage: Suggested',
          publicationPlan: null,
          responseSource: null,
          usedRepositoryContext: null,
          skipReason: 'missing_publication_plan',
        },
      },
      tone: {
        labelsToAdd: [],
      },
      curation: {
        labelsToAdd: [],
      },
    });

    // Act
    await applyAiTriageGovernanceActions(input);

    // Assert
    expect(mockedBuildIssueAiTriageActionPlan).toHaveBeenCalledTimes(1);
    expect(mockedBuildIssueAiTriageActionPlan.mock.calls[0]?.[0].kindPolicy).toEqual({
      bugLabel: 'kind/bug',
      featureLabel: 'kind/feature',
      questionLabel: 'kind/question',
      kindLabels: ['kind/bug', 'kind/feature', 'kind/question'],
      classificationConfidenceThreshold: 0.7,
      sentimentConfidenceThreshold: 0.65,
    });
    expect(mockedBuildIssueAiTriageActionPlan.mock.calls[0]?.[0].duplicatePolicy).toEqual({
      similarityThreshold: 0.88,
      commentPrefix: 'AI Triage: Possible duplicate of #',
    });
    expect(mockedBuildIssueAiTriageActionPlan.mock.calls[0]?.[0].questionPolicy).toMatchObject({
      classificationConfidenceThreshold: 0.7,
    });
  });
});
