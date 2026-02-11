import {
  createAiTriageGovernanceActionsExecutionContext,
  type ApplyAiTriageGovernanceActionsInput,
} from '../../../../src/features/triage/application/services/ai-triage-governance-actions-context.service';

const createExecutionContextInput = (labels: string[]): ApplyAiTriageGovernanceActionsInput => ({
  action: 'opened',
  repositoryFullName: 'org/repo',
  issue: {
    number: 42,
    title: 'Question about setup',
    body: 'How can I configure this project in CI?',
    labels,
  },
  aiAnalysis: {
    classification: {
      type: 'question',
      confidence: 0.9,
      reasoning: 'Issue asks for setup guidance.',
    },
    duplicateDetection: {
      isDuplicate: false,
      originalIssueNumber: null,
      similarityScore: 0.1,
    },
    sentiment: {
      tone: 'neutral',
      confidence: 0.8,
      reasoning: 'Neutral wording.',
    },
  },
  llmProvider: 'ollama',
  llmModel: 'llama3.2',
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

describe('AiTriageGovernanceActionsContextService', () => {
  it('should skip adding label when already present', async () => {
    // Arrange
    const input = createExecutionContextInput(['kind/question']);
    const context = createAiTriageGovernanceActionsExecutionContext(input);

    // Act
    const wasLabelAdded = await context.addLabelIfMissing('kind/question');

    // Assert
    expect(wasLabelAdded).toBe(false);
    expect(input.governanceGateway.addLabels).not.toHaveBeenCalled();
    expect(context.actionsAppliedCount).toBe(0);
  });

  it('should add label when missing and increment applied actions count', async () => {
    // Arrange
    const input = createExecutionContextInput([]);
    const context = createAiTriageGovernanceActionsExecutionContext(input);

    // Act
    const wasLabelAdded = await context.addLabelIfMissing('kind/question');

    // Assert
    expect(wasLabelAdded).toBe(true);
    expect(input.governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      labels: ['kind/question'],
    });
    expect(context.actionsAppliedCount).toBe(1);
  });

  it('should skip removing label when absent', async () => {
    // Arrange
    const input = createExecutionContextInput([]);
    const context = createAiTriageGovernanceActionsExecutionContext(input);

    // Act
    await context.removeLabelIfPresent('kind/bug');

    // Assert
    expect(input.governanceGateway.removeLabel).not.toHaveBeenCalled();
    expect(context.actionsAppliedCount).toBe(0);
  });

  it('should remove label when present and increment applied actions count', async () => {
    // Arrange
    const input = createExecutionContextInput(['kind/bug']);
    const context = createAiTriageGovernanceActionsExecutionContext(input);

    // Act
    await context.removeLabelIfPresent('kind/bug');

    // Assert
    expect(input.governanceGateway.removeLabel).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      label: 'kind/bug',
    });
    expect(context.actionsAppliedCount).toBe(1);
  });
});
