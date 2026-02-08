import {
  AI_MAX_TOKENS,
  AI_RECENT_ISSUES_LIMIT,
  AI_SUPPORTED_ACTIONS,
  AI_TEMPERATURE,
  AI_TIMEOUT_MS,
} from '../constants/ai-triage.constants';
import type { GovernanceGateway } from '../ports/governance-gateway.port';
import type { IssueHistoryGateway } from '../ports/issue-history-gateway.port';
import type { RepositoryContextGateway } from '../ports/repository-context-gateway.port';
import { parseAiAnalysis } from '../services/ai-analysis-normalizer.service';
import { applyAiTriageGovernanceActions } from '../services/apply-ai-triage-governance-actions.service';
import type { LLMGateway } from '../../../../shared/application/ports/llm-gateway.port';
import type { QuestionResponseMetricsPort } from '../../../../shared/application/ports/question-response-metrics.port';
import {
  buildIssueTriageUserPrompt,
  ISSUE_TRIAGE_SYSTEM_PROMPT,
} from '../../../../shared/application/prompts/issue-triage.prompt';

type AiSupportedAction = (typeof AI_SUPPORTED_ACTIONS)[number];

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
  governanceGateway: GovernanceGateway;
  questionResponseMetrics?: QuestionResponseMetricsPort;
  botLogin?: string;
  logger?: Logger;
}

const isSupportedAction = (action: string): action is AiSupportedAction =>
  AI_SUPPORTED_ACTIONS.includes(action as AiSupportedAction);

export const analyzeIssueWithAi =
  ({
    llmGateway,
    issueHistoryGateway,
    repositoryContextGateway,
    governanceGateway,
    questionResponseMetrics,
    botLogin,
    logger = console,
  }: Dependencies) =>
  async (input: AnalyzeIssueWithAiInput): Promise<AnalyzeIssueWithAiResult> => {
    if (!isSupportedAction(input.action)) {
      return { status: 'skipped', reason: 'unsupported_action' };
    }

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

      const llmResult = await llmGateway.generateJson({
        systemPrompt: ISSUE_TRIAGE_SYSTEM_PROMPT,
        userPrompt: buildIssueTriageUserPrompt({
          issueTitle: input.issue.title,
          issueBody: input.issue.body,
          repositoryReadme,
          recentIssues: recentIssues.map((recentIssue) => ({
            number: recentIssue.number,
            title: recentIssue.title,
          })),
        }),
        maxTokens: AI_MAX_TOKENS,
        timeoutMs: AI_TIMEOUT_MS,
        temperature: AI_TEMPERATURE,
      });

      const aiAnalysis = parseAiAnalysis(llmResult.rawText, input.issue.number);
      if (!aiAnalysis) {
        logger.error('AnalyzeIssueWithAiUseCase failed parsing AI response. Applying fail-open policy.', {
          repositoryFullName: input.repositoryFullName,
          issueNumber: input.issue.number,
          rawText: llmResult.rawText,
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
        repositoryReadme,
        governanceGateway,
        issueHistoryGateway,
        questionResponseMetrics,
        botLogin,
        logger,
      });

      return { status: 'completed' };
    } catch (error: unknown) {
      logger.error('AnalyzeIssueWithAiUseCase failed. Applying fail-open policy.', {
        repositoryFullName: input.repositoryFullName,
        issueNumber: input.issue.number,
        error,
      });

      return { status: 'skipped', reason: 'ai_unavailable' };
    }
  };
