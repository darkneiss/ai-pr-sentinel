import type { GovernanceGateway } from '../../../../src/features/triage/application/ports/governance-gateway.port';
import type { IssueHistoryGateway } from '../../../../src/features/triage/application/ports/issue-history-gateway.port';
import {
  analyzeIssueWithAi,
  type AnalyzeIssueWithAiInput,
} from '../../../../src/features/triage/application/use-cases/analyze-issue-with-ai.use-case';
import type { LLMGateway } from '../../../../src/shared/application/ports/llm-gateway.port';
import {
  AI_TRIAGE_LOG_EVENT_COMPLETED,
  AI_TRIAGE_LOG_EVENT_FAILED,
  AI_TRIAGE_LOG_EVENT_STARTED,
  AI_TRIAGE_LOG_STATUS_COMPLETED,
  AI_TRIAGE_LOG_STATUS_FAILED,
  AI_TRIAGE_LOG_STATUS_STARTED,
  AI_TRIAGE_LOG_STEPS,
  type AiTriageLogStep,
  LLM_MODEL_ENV_VAR,
  LLM_PROVIDER_ENV_VAR,
} from '../../../../src/features/triage/application/constants/ai-triage.constants';

const createLlmGatewayMock = (): jest.Mocked<LLMGateway> => ({
  generateJson: jest.fn().mockResolvedValue({
    rawText: JSON.stringify({
      classification: {
        type: 'bug',
        confidence: 0.95,
        reasoning: 'The issue reports a reproducible software failure.',
      },
      duplicateDetection: {
        isDuplicate: false,
        originalIssueNumber: null,
        similarityScore: 0.1,
        hasExplicitOriginalIssueReference: false,
      },
      sentiment: {
        tone: 'neutral',
        reasoning: 'The report is neutral and technical.',
      },
    }),
  }),
});

const createIssueHistoryGatewayMock = (): jest.Mocked<IssueHistoryGateway> => ({
  findRecentIssues: jest.fn().mockResolvedValue([
    {
      number: 10,
      title: 'Cannot login in Safari',
      labels: ['kind/bug'],
      state: 'open',
    },
  ]),
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
    title: 'Login fails intermittently',
    body: 'Users report intermittent auth failures in mobile browsers after one hour.',
    labels: ['kind/bug'],
  },
  ...overrides,
});

const createLogger = (): { debug: jest.Mock; error: jest.Mock } => ({
  debug: jest.fn(),
  error: jest.fn(),
});

describe('AnalyzeIssueWithAiUseCase (Observability Logs)', () => {
  it('should emit started and completed logs for each triage step', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    const logger = createLogger();
    const config = {
      get: (key: string) => {
        if (key === LLM_PROVIDER_ENV_VAR) {
          return 'groq';
        }
        if (key === LLM_MODEL_ENV_VAR) {
          return 'openai/gpt-oss-20b';
        }
        return undefined;
      },
      getBoolean: () => undefined,
    };
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      governanceGateway,
      logger,
      config,
    });

    // Act
    const result = await run(createInput());

    // Assert
    expect(result).toEqual({ status: 'completed' });
    const startedEvents = logger.debug.mock.calls.filter(([message]) => message === AI_TRIAGE_LOG_EVENT_STARTED);
    const completedEvents = logger.debug.mock.calls.filter(([message]) => message === AI_TRIAGE_LOG_EVENT_COMPLETED);
    expect(startedEvents).toHaveLength(AI_TRIAGE_LOG_STEPS.length);
    expect(completedEvents).toHaveLength(AI_TRIAGE_LOG_STEPS.length);

    AI_TRIAGE_LOG_STEPS.forEach((step: AiTriageLogStep) => {
      const startedContext = startedEvents.find(([, context]) => (context as { step?: string }).step === step)?.[1] as
        | Record<string, unknown>
        | undefined;
      const completedContext = completedEvents.find(([, context]) => (context as { step?: string }).step === step)?.[1] as
        | Record<string, unknown>
        | undefined;

      expect(startedContext).toEqual(
        expect.objectContaining({
          repositoryFullName: 'org/repo',
          issueNumber: 42,
          step,
          status: AI_TRIAGE_LOG_STATUS_STARTED,
          provider: 'groq',
          model: 'openai/gpt-oss-20b',
          durationMs: expect.any(Number),
        }),
      );
      expect(completedContext).toEqual(
        expect.objectContaining({
          repositoryFullName: 'org/repo',
          issueNumber: 42,
          step,
          status: AI_TRIAGE_LOG_STATUS_COMPLETED,
          provider: 'groq',
          model: 'openai/gpt-oss-20b',
          durationMs: expect.any(Number),
        }),
      );
    });
  });

  it('should emit failed logs for each triage step when LLM fails', async () => {
    // Arrange
    const llmGateway = createLlmGatewayMock();
    llmGateway.generateJson.mockRejectedValueOnce(new Error('provider unavailable'));
    const issueHistoryGateway = createIssueHistoryGatewayMock();
    const governanceGateway = createGovernanceGatewayMock();
    const logger = createLogger();
    const config = {
      get: (key: string) => {
        if (key === LLM_PROVIDER_ENV_VAR) {
          return 'groq';
        }
        if (key === LLM_MODEL_ENV_VAR) {
          return 'openai/gpt-oss-20b';
        }
        return undefined;
      },
      getBoolean: () => undefined,
    };
    const run = analyzeIssueWithAi({
      llmGateway,
      issueHistoryGateway,
      governanceGateway,
      logger,
      config,
    });

    // Act
    const result = await run(createInput());

    // Assert
    expect(result).toEqual({ status: 'skipped', reason: 'ai_unavailable' });
    const failedEvents = logger.debug.mock.calls.filter(([message]) => message === AI_TRIAGE_LOG_EVENT_FAILED);
    expect(failedEvents).toHaveLength(AI_TRIAGE_LOG_STEPS.length);

    AI_TRIAGE_LOG_STEPS.forEach((step: AiTriageLogStep) => {
      const failedContext = failedEvents.find(([, context]) => (context as { step?: string }).step === step)?.[1] as
        | Record<string, unknown>
        | undefined;

      expect(failedContext).toEqual(
        expect.objectContaining({
          repositoryFullName: 'org/repo',
          issueNumber: 42,
          step,
          status: AI_TRIAGE_LOG_STATUS_FAILED,
          provider: 'groq',
          model: 'openai/gpt-oss-20b',
          durationMs: expect.any(Number),
        }),
      );
    });
  });
});
