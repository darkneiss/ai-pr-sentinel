import {
  AI_MAX_TOKENS,
  AI_RECENT_ISSUES_LIMIT,
  AI_TEMPERATURE,
  AI_TRIAGE_LOG_EVENT_FAILED,
  AI_TRIAGE_LOG_STATUS_FAILED,
  AI_TRIAGE_LOG_STEPS,
  AI_TRIAGE_LOG_UNKNOWN_VALUE,
  DEFAULT_LLM_PROVIDER,
  LLM_LOG_RAW_RESPONSE_ENV_VAR,
  LLM_MODEL_ENV_VAR,
  LLM_PROVIDER_ENV_VAR,
  LLM_RAW_TEXT_LOG_PREVIEW_CHARS,
  resolveAiTimeoutMs,
} from '../constants/ai-triage.constants';
import type { GovernanceGateway } from '../ports/governance-gateway.port';
import type { IssueHistoryGateway } from '../ports/issue-history-gateway.port';
import type { RepositoryContextGateway } from '../ports/repository-context-gateway.port';
import { parseAiAnalysis } from '../services/ai-analysis-normalizer.service';
import { applyAiTriageGovernanceActions } from '../services/apply-ai-triage-governance-actions.service';
import { isIssueAiTriageActionSupported } from '../../domain/services/issue-ai-triage-action-policy.service';
import type { LLMGateway } from '../../../../shared/application/ports/llm-gateway.port';
import type { IssueTriagePromptGateway } from '../../../../shared/application/ports/issue-triage-prompt-gateway.port';
import type { QuestionResponseMetricsPort } from '../../../../shared/application/ports/question-response-metrics.port';
import type { ConfigPort } from '../../../../shared/application/ports/config.port';
import { renderIssueTriageUserPrompt } from '../../../../shared/application/prompts/issue-triage-prompt.builder';
import {
  buildIssueTriageUserPrompt,
  ISSUE_TRIAGE_SYSTEM_PROMPT,
} from '../../../../shared/application/prompts/issue-triage.prompt';

export interface AnalyzeIssueWithAiInput {
  action: string;
  repositoryFullName: string;
  issue: {
    number: number;
    title: string;
    body: string;
    labels: string[];
  };
}

export interface AnalyzeIssueWithAiResult {
  status: 'completed' | 'skipped';
  reason?: 'unsupported_action' | 'ai_unavailable';
}

interface Logger {
  debug?: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  info?: (message: string, ...args: unknown[]) => void;
}

interface Dependencies {
  llmGateway: LLMGateway;
  issueHistoryGateway: IssueHistoryGateway;
  repositoryContextGateway?: RepositoryContextGateway;
  issueTriagePromptGateway?: IssueTriagePromptGateway;
  governanceGateway: GovernanceGateway;
  questionResponseMetrics?: QuestionResponseMetricsPort;
  botLogin?: string;
  config?: ConfigPort;
  logger?: Logger;
}

const resolveAiProvider = (config?: ConfigPort): string =>
  (config?.get(LLM_PROVIDER_ENV_VAR) ?? DEFAULT_LLM_PROVIDER).toLowerCase();

const resolveAiModel = (config?: ConfigPort): string => config?.get(LLM_MODEL_ENV_VAR) ?? AI_TRIAGE_LOG_UNKNOWN_VALUE;

const buildSafeRawTextLogContext = (
  rawText: string,
  config?: ConfigPort,
): { rawTextLength: number; rawTextPreview?: string } => {
  const rawTextLength = rawText.length;
  const shouldLogRawText = config?.getBoolean(LLM_LOG_RAW_RESPONSE_ENV_VAR) === true;
  const nodeEnv = (config?.get('NODE_ENV') ?? '').trim().toLowerCase();
  const isProduction = nodeEnv === 'production';

  if (!shouldLogRawText || isProduction) {
    return { rawTextLength };
  }

  return {
    rawTextLength,
    rawTextPreview: rawText.slice(0, LLM_RAW_TEXT_LOG_PREVIEW_CHARS),
  };
};

const logAiTriageFailures = (
  logger: Logger | undefined,
  input: AnalyzeIssueWithAiInput,
  durationMs: number,
  provider: string,
  model: string,
): void => {
  const debug = logger?.debug;
  if (!debug) {
    return;
  }

  AI_TRIAGE_LOG_STEPS.forEach((step) => {
    debug(AI_TRIAGE_LOG_EVENT_FAILED, {
      repositoryFullName: input.repositoryFullName,
      issueNumber: input.issue.number,
      step,
      durationMs,
      status: AI_TRIAGE_LOG_STATUS_FAILED,
      provider,
      model,
    });
  });
};

export const analyzeIssueWithAi =
  ({
    llmGateway,
    issueHistoryGateway,
    repositoryContextGateway,
    issueTriagePromptGateway,
    governanceGateway,
    questionResponseMetrics,
    botLogin,
    config,
    logger = console,
  }: Dependencies) =>
  async (input: AnalyzeIssueWithAiInput): Promise<AnalyzeIssueWithAiResult> => {
    if (!isIssueAiTriageActionSupported(input.action)) {
      return { status: 'skipped', reason: 'unsupported_action' };
    }

    const triageStartedAt = Date.now();
    const provider = resolveAiProvider(config);
    const model = resolveAiModel(config);

    try {
      const recentIssues = await issueHistoryGateway.findRecentIssues({
        repositoryFullName: input.repositoryFullName,
        limit: AI_RECENT_ISSUES_LIMIT,
      });
      let repositoryReadme: string | undefined;
      if (repositoryContextGateway) {
        try {
          const repositoryContext = await repositoryContextGateway.findRepositoryContext({
            repositoryFullName: input.repositoryFullName,
          });
          repositoryReadme = repositoryContext.readme;
        } catch (error: unknown) {
          logger.info?.('AnalyzeIssueWithAiUseCase failed loading repository context. Continuing without it.', {
            repositoryFullName: input.repositoryFullName,
            issueNumber: input.issue.number,
            error,
          });
        }
      }

      const promptInput = {
        issueTitle: input.issue.title,
        issueBody: input.issue.body,
        repositoryReadme,
        recentIssues: recentIssues.map((recentIssue) => ({
          number: recentIssue.number,
          title: recentIssue.title,
        })),
      };
      const resolvedPrompt = issueTriagePromptGateway?.getPrompt();
      const systemPrompt = resolvedPrompt?.systemPrompt ?? ISSUE_TRIAGE_SYSTEM_PROMPT;
      const userPrompt = resolvedPrompt
        ? renderIssueTriageUserPrompt({
            template: resolvedPrompt.userPromptTemplate,
            issueTitle: promptInput.issueTitle,
            issueBody: promptInput.issueBody,
            repositoryContext: promptInput.repositoryReadme,
            recentIssues: promptInput.recentIssues,
          })
        : buildIssueTriageUserPrompt(promptInput);
      const maxTokens = resolvedPrompt?.config?.maxTokens ?? AI_MAX_TOKENS;
      const temperature = resolvedPrompt?.config?.temperature ?? AI_TEMPERATURE;
      const timeoutMs = resolveAiTimeoutMs(config);

      const llmResult = await llmGateway.generateJson({
        systemPrompt,
        userPrompt,
        maxTokens,
        timeoutMs,
        temperature,
      });

      const aiAnalysis = parseAiAnalysis(llmResult.rawText, input.issue.number);
      if (!aiAnalysis) {
        logAiTriageFailures(logger, input, Date.now() - triageStartedAt, provider, model);
        logger.error('AnalyzeIssueWithAiUseCase failed parsing AI response. Applying fail-open policy.', {
          repositoryFullName: input.repositoryFullName,
          issueNumber: input.issue.number,
          ...buildSafeRawTextLogContext(llmResult.rawText, config),
        });
        return { status: 'skipped', reason: 'ai_unavailable' };
      }

      logger.debug?.('AnalyzeIssueWithAiUseCase normalized AI analysis.', {
        repositoryFullName: input.repositoryFullName,
        issueNumber: input.issue.number,
        classification: {
          type: aiAnalysis.classification.type,
          confidence: aiAnalysis.classification.confidence,
        },
        duplicateDetection: {
          isDuplicate: aiAnalysis.duplicateDetection.isDuplicate,
          originalIssueNumber: aiAnalysis.duplicateDetection.originalIssueNumber,
          similarityScore: aiAnalysis.duplicateDetection.similarityScore,
        },
        sentiment: {
          tone: aiAnalysis.sentiment.tone,
          confidence: aiAnalysis.sentiment.confidence,
        },
        hasSuggestedResponse:
          typeof aiAnalysis.suggestedResponse === 'string' && aiAnalysis.suggestedResponse.trim().length > 0,
      });

      await applyAiTriageGovernanceActions({
        action: input.action,
        repositoryFullName: input.repositoryFullName,
        issue: input.issue,
        aiAnalysis,
        recentIssues,
        repositoryReadme,
        governanceGateway,
        issueHistoryGateway,
        questionResponseMetrics,
        botLogin,
        llmProvider: provider,
        llmModel: model,
        logger,
      });

      return { status: 'completed' };
    } catch (error: unknown) {
      logAiTriageFailures(logger, input, Date.now() - triageStartedAt, provider, model);
      logger.error('AnalyzeIssueWithAiUseCase failed. Applying fail-open policy.', {
        repositoryFullName: input.repositoryFullName,
        issueNumber: input.issue.number,
        error,
      });

      return { status: 'skipped', reason: 'ai_unavailable' };
    }
  };
