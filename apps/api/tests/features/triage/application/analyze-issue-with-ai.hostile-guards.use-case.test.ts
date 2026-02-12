import type { GovernanceGateway } from '../../../../src/features/triage/application/ports/governance-gateway.port';
import type { IssueHistoryGateway } from '../../../../src/features/triage/application/ports/issue-history-gateway.port';
import {
  analyzeIssueWithAi,
  type AnalyzeIssueWithAiInput,
} from '../../../../src/features/triage/application/use-cases/analyze-issue-with-ai.use-case';
import type { LLMGateway } from '../../../../src/shared/application/ports/llm-gateway.port';

const createIssueHistoryGatewayMock = (): jest.Mocked<IssueHistoryGateway> => ({
  findRecentIssues: jest.fn().mockResolvedValue([]),
  hasIssueCommentWithPrefix: jest.fn().mockResolvedValue(false),
});

const createGovernanceGatewayMock = (): jest.Mocked<GovernanceGateway> => ({
  addLabels: jest.fn().mockResolvedValue(undefined),
  removeLabel: jest.fn().mockResolvedValue(undefined),
  createComment: jest.fn().mockResolvedValue(undefined),
  logValidatedIssue: jest.fn().mockResolvedValue(undefined),
});

const createInput = (overrides: Partial<AnalyzeIssueWithAiInput> = {}): AnalyzeIssueWithAiInput => ({
  action: 'opened',
  repositoryFullName: 'org/repo',
  issue: {
    number: 42,
    title: 'How can I fix this bug?',
    body: 'This is broken and setup fails.',
    labels: [],
  },
  ...overrides,
});

const createRun = (rawText: string) => {
  const llmGateway: jest.Mocked<LLMGateway> = {
    generateJson: jest.fn().mockResolvedValue({ rawText }),
  };
  const issueHistoryGateway = createIssueHistoryGatewayMock();
  const governanceGateway = createGovernanceGatewayMock();

  return {
    run: analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      governanceGateway,
    }),
    governanceGateway,
  };
};

describe('AnalyzeIssueWithAiUseCase (Hostile Guards)', () => {
  it('should skip kind/bug label when issue has hostile sentiment with high confidence', async () => {
    // Arrange
    const { run, governanceGateway } = createRun(
      JSON.stringify({
        classification: {
          type: 'bug',
          confidence: 0.95,
          reasoning: 'The user says it does not work.',
        },
        duplicateDetection: {
          isDuplicate: false,
          originalIssueNumber: null,
          similarityScore: 0.1,
        },
        sentiment: {
          tone: 'hostile',
          confidence: 0.95,
          reasoning: 'Insulting language.',
        },
      }),
    );

    // Act
    const result = await run(createInput({ issue: { ...createInput().issue, number: 34 } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).not.toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 34,
      labels: ['kind/bug'],
    });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 34,
      labels: ['triage/monitor'],
    });
  });

  it('should remove existing kind label when issue has hostile sentiment with high confidence', async () => {
    // Arrange
    const { run, governanceGateway } = createRun(
      JSON.stringify({
        classification: {
          type: 'bug',
          confidence: 0.95,
          reasoning: 'Hostile content should prevail over classification labels.',
        },
        duplicateDetection: {
          isDuplicate: false,
          originalIssueNumber: null,
          similarityScore: 0.1,
        },
        sentiment: {
          tone: 'hostile',
          confidence: 0.95,
          reasoning: 'Hostile tone.',
        },
      }),
    );

    // Act
    const result = await run(
      createInput({
        issue: {
          number: 35,
          title: 'Esto va fatal y me cabrea',
          body: 'Fails with error 500. Steps to reproduce: open login, submit form, crash.',
          labels: ['kind/bug'],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.removeLabel).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 35,
      label: 'kind/bug',
    });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 35,
      labels: ['triage/monitor'],
    });
  });

  it('should not add triage/monitor when AI tone is neutral even if issue text is hostile', async () => {
    // Arrange
    const { run, governanceGateway } = createRun(
      JSON.stringify({
        classification: {
          type: 'bug',
          confidence: 0,
        },
        duplicateDetection: {
          isDuplicate: false,
          originalIssueNumber: null,
          similarityScore: 0,
        },
        sentiment: {
          tone: 'neutral',
        },
      }),
    );

    // Act
    const result = await run(
      createInput({
        issue: {
          number: 19,
          title: 'No entiendo este repo',
          body: 'Sigo sin entender por qué este repo parece hecho fatal.',
          labels: [],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).not.toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 19,
      labels: ['triage/monitor'],
    });
  });

  it('should not add triage/monitor when AI tone is neutral and text is non-hostile', async () => {
    // Arrange
    const { run, governanceGateway } = createRun(
      JSON.stringify({
        classification: {
          type: 'bug',
          confidence: 0,
        },
        duplicateDetection: {
          isDuplicate: false,
          originalIssueNumber: null,
          similarityScore: 0,
        },
        sentiment: {
          tone: 'neutral',
        },
      }),
    );

    // Act
    const result = await run(
      createInput({
        issue: {
          number: 20,
          title: 'No entiendo el setup',
          body: 'Podriais explicar como levantarlo en local paso a paso?',
          labels: [],
        },
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).not.toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 20,
      labels: ['triage/monitor'],
    });
  });

  it('should not create fallback question comment when tone is hostile', async () => {
    // Arrange
    const { run, governanceGateway } = createRun(
      JSON.stringify({
        classification: {
          type: 'bug',
          confidence: 0.8,
          reasoning: 'Bug report.',
        },
        duplicateDetection: {
          isDuplicate: false,
          originalIssueNumber: null,
          similarityScore: 0.1,
        },
        sentiment: {
          tone: 'hostile',
          reasoning: 'Contains hostile language.',
        },
      }),
    );

    // Act
    const result = await run(createInput({ issue: { ...createInput().issue, number: 42 } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 42,
      labels: ['triage/monitor'],
    });
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
  });

  it('should not create ai suggested question comment when tone is hostile', async () => {
    // Arrange
    const { run, governanceGateway } = createRun(
      JSON.stringify({
        classification: {
          type: 'question',
          confidence: 0.95,
          reasoning: 'Question issue.',
        },
        duplicateDetection: {
          isDuplicate: false,
          originalIssueNumber: null,
          similarityScore: 0.1,
        },
        sentiment: {
          tone: 'hostile',
          reasoning: 'Hostile tone.',
        },
        suggestedResponse: '- Set env vars\n- Run pnpm --filter api dev',
      }),
    );

    // Act
    const result = await run(createInput({ issue: { ...createInput().issue, number: 43 } }));

    // Assert
    expect(result).toEqual({ status: 'completed' });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 43,
      labels: ['kind/question'],
    });
    expect(governanceGateway.addLabels).toHaveBeenCalledWith({
      repositoryFullName: 'org/repo',
      issueNumber: 43,
      labels: ['triage/monitor'],
    });
    expect(governanceGateway.createComment).not.toHaveBeenCalled();
  });
});
