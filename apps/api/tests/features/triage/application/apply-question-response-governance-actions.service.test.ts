import { applyQuestionResponseGovernanceActions } from '../../../../src/features/triage/application/services/apply-question-response-governance-actions.service';
import type { AiTriageGovernanceActionsExecutionContext } from '../../../../src/features/triage/application/services/ai-triage-governance-actions-context.service';
import type { IssueAiTriageQuestionPlan } from '../../../../src/features/triage/domain/services/issue-ai-triage-action-plan.service';

const createExecutionContext = (): AiTriageGovernanceActionsExecutionContext => ({
  action: 'opened',
  repositoryFullName: 'org/repo',
  issue: {
    number: 42,
    title: 'How to configure this project?',
    body: 'Can I get setup help?',
    labels: [],
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
  questionResponseMetrics: {
    increment: jest.fn(),
    snapshot: jest.fn(() => ({
      aiSuggestedResponse: 0,
      fallbackChecklist: 0,
      total: 0,
    })),
  },
  botLogin: 'sentinel-bot',
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
});

describe('applyQuestionResponseGovernanceActions', () => {
  it('should fail fast when question response plan is missing', async () => {
    // Arrange
    const context = createExecutionContext();

    // Act
    const result = applyQuestionResponseGovernanceActions(
      context,
      undefined as unknown as IssueAiTriageQuestionPlan,
    );

    // Assert
    await expect(result).rejects.toThrow('Question response action plan is required.');
  });

  it('should skip when publication plan is null', async () => {
    // Arrange
    const context = createExecutionContext();
    const plan: IssueAiTriageQuestionPlan = {
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
    };

    // Act
    await applyQuestionResponseGovernanceActions(context, plan);

    // Assert
    expect(context.governanceGateway.createComment).not.toHaveBeenCalled();
    expect(context.incrementActionsAppliedCount).not.toHaveBeenCalled();
  });

  it('should skip history lookup and metrics when publication plan is null', async () => {
    // Arrange
    const context = createExecutionContext();
    const plan: IssueAiTriageQuestionPlan = {
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
    };

    // Act
    await applyQuestionResponseGovernanceActions(context, plan);

    // Assert
    expect(context.issueHistoryGateway.hasIssueCommentWithPrefix).not.toHaveBeenCalled();
    expect(context.questionResponseMetrics?.increment).not.toHaveBeenCalled();
  });

  it('should trust precomputed preparation and skip history lookup when preparation says not to check', async () => {
    // Arrange
    const context = createExecutionContext();
    const plan: IssueAiTriageQuestionPlan = {
      decision: {
        shouldCreateComment: true,
        responseSource: 'ai_suggested_response',
        responseBody: 'Use .env.example as baseline',
      },
      commentPublicationPlan: {
        responseSource: 'ai_suggested_response',
        responseBody: 'Use .env.example as baseline',
        commentPrefix: 'AI Triage: Suggested guidance',
        usedRepositoryContext: false,
      },
      publicationPreparation: {
        shouldCheckExistingQuestionReplyComment: false,
        historyLookupBodyPrefix: 'AI Triage: Suggested',
        publicationPlan: null,
        responseSource: null,
        usedRepositoryContext: null,
        skipReason: 'missing_publication_plan',
      },
    };

    // Act
    await applyQuestionResponseGovernanceActions(context, plan);

    // Assert
    expect(context.issueHistoryGateway.hasIssueCommentWithPrefix).not.toHaveBeenCalled();
    expect(context.questionResponseMetrics?.increment).not.toHaveBeenCalled();
    expect(context.governanceGateway.createComment).not.toHaveBeenCalled();
  });

  it('should skip publishing when a question reply comment already exists', async () => {
    // Arrange
    const context = createExecutionContext();
    (context.issueHistoryGateway.hasIssueCommentWithPrefix as jest.MockedFunction<
      typeof context.issueHistoryGateway.hasIssueCommentWithPrefix
    >).mockResolvedValue(true);
    const plan: IssueAiTriageQuestionPlan = {
      decision: {
        shouldCreateComment: true,
        responseSource: 'ai_suggested_response',
        responseBody: 'Try setting API_URL in your .env',
      },
      commentPublicationPlan: {
        responseSource: 'ai_suggested_response',
        responseBody: 'Try setting API_URL in your .env',
        commentPrefix: 'AI Triage: Suggested guidance',
        usedRepositoryContext: false,
      },
      publicationPreparation: {
        shouldCheckExistingQuestionReplyComment: true,
        historyLookupBodyPrefix: 'AI Triage: Suggested',
        publicationPlan: {
          responseSource: 'ai_suggested_response',
          responseBody: 'Try setting API_URL in your .env',
          commentPrefix: 'AI Triage: Suggested guidance',
          usedRepositoryContext: false,
        },
        responseSource: 'ai_suggested_response',
        usedRepositoryContext: false,
        skipReason: null,
      },
    };

    // Act
    await applyQuestionResponseGovernanceActions(context, plan);

    // Assert
    expect(context.governanceGateway.createComment).not.toHaveBeenCalled();
    expect(context.incrementActionsAppliedCount).not.toHaveBeenCalled();
  });

  it('should publish question response comment when not already present', async () => {
    // Arrange
    const context = createExecutionContext();
    const plan: IssueAiTriageQuestionPlan = {
      decision: {
        shouldCreateComment: true,
        responseSource: 'fallback_checklist',
        responseBody: '- Share your current .env values',
      },
      commentPublicationPlan: {
        responseSource: 'fallback_checklist',
        responseBody: '- Share your current .env values',
        commentPrefix: 'AI Triage: Suggested setup checklist',
        usedRepositoryContext: true,
      },
      publicationPreparation: {
        shouldCheckExistingQuestionReplyComment: true,
        historyLookupBodyPrefix: 'AI Triage: Suggested',
        publicationPlan: {
          responseSource: 'fallback_checklist',
          responseBody: '- Share your current .env values',
          commentPrefix: 'AI Triage: Suggested setup checklist',
          usedRepositoryContext: true,
        },
        responseSource: 'fallback_checklist',
        usedRepositoryContext: true,
        skipReason: null,
      },
    };

    // Act
    await applyQuestionResponseGovernanceActions(context, plan);

    // Assert
    expect(context.governanceGateway.createComment).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      body: 'AI Triage: Suggested setup checklist\n\n- Share your current .env values',
    });
    expect(context.incrementActionsAppliedCount).toHaveBeenCalledTimes(1);
  });

  it('should use domain-precomputed history lookup prefix when checking existing comments', async () => {
    // Arrange
    const context = createExecutionContext();
    const plan: IssueAiTriageQuestionPlan = {
      decision: {
        shouldCreateComment: true,
        responseSource: 'ai_suggested_response',
        responseBody: 'Check readme setup section',
      },
      commentPublicationPlan: {
        responseSource: 'ai_suggested_response',
        responseBody: 'Check readme setup section',
        commentPrefix: 'AI Triage: Suggested guidance',
        usedRepositoryContext: true,
      },
      publicationPreparation: {
        shouldCheckExistingQuestionReplyComment: true,
        historyLookupBodyPrefix: 'Custom Question Prefix',
        publicationPlan: {
          responseSource: 'ai_suggested_response',
          responseBody: 'Check readme setup section',
          commentPrefix: 'AI Triage: Suggested guidance',
          usedRepositoryContext: true,
        },
        responseSource: 'ai_suggested_response',
        usedRepositoryContext: true,
        skipReason: null,
      },
    };

    // Act
    await applyQuestionResponseGovernanceActions(context, plan);

    // Assert
    expect(context.issueHistoryGateway.hasIssueCommentWithPrefix).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      bodyPrefix: 'Custom Question Prefix',
      authorLogin: 'sentinel-bot',
    });
  });
});
