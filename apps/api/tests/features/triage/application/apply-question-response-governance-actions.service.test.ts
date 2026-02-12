import { applyQuestionResponseGovernanceActions } from '../../../../src/features/triage/application/services/apply-question-response-governance-actions.service';
import type { AiTriageGovernanceActionsExecutionContext } from '../../../../src/features/triage/application/services/ai-triage-governance-actions-context.service';
import type { QuestionResponseGovernanceExecutionPlan } from '../../../../src/features/triage/application/services/apply-question-response-governance-actions.service';

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
      undefined as unknown as QuestionResponseGovernanceExecutionPlan,
    );

    // Assert
    await expect(result).rejects.toThrow('Question response action plan is required.');
  });

  it('should skip when publication plan is null', async () => {
    // Arrange
    const context = createExecutionContext();
    const plan: QuestionResponseGovernanceExecutionPlan = {
      questionCommentPublicationPlan: null,
    };

    // Act
    await applyQuestionResponseGovernanceActions(context, plan);

    // Assert
    expect(context.governanceGateway.createComment).not.toHaveBeenCalled();
    expect(context.incrementActionsAppliedCount).not.toHaveBeenCalled();
  });

  it('should skip publishing when a question reply comment already exists', async () => {
    // Arrange
    const context = createExecutionContext();
    (context.issueHistoryGateway.hasIssueCommentWithPrefix as jest.MockedFunction<
      typeof context.issueHistoryGateway.hasIssueCommentWithPrefix
    >).mockResolvedValue(true);
    const plan: QuestionResponseGovernanceExecutionPlan = {
      questionCommentPublicationPlan: {
        responseSource: 'ai_suggested_response',
        responseBody: 'Try setting API_URL in your .env',
        commentPrefix: 'AI Triage: Suggested guidance',
        usedRepositoryContext: false,
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
    const plan: QuestionResponseGovernanceExecutionPlan = {
      questionCommentPublicationPlan: {
        responseSource: 'fallback_checklist',
        responseBody: '- Share your current .env values',
        commentPrefix: 'AI Triage: Suggested setup checklist',
        usedRepositoryContext: true,
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
});
