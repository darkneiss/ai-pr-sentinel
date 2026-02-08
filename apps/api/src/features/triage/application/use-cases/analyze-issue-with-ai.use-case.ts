import {
  AI_CLASSIFICATION_CONFIDENCE_THRESHOLD,
  AI_DUPLICATE_COMMENT_PREFIX,
  AI_DUPLICATE_SIMILARITY_THRESHOLD,
  AI_KIND_BUG_LABEL,
  AI_KIND_FEATURE_LABEL,
  AI_KIND_LABELS,
  AI_KIND_QUESTION_LABEL,
  AI_MAX_TOKENS,
  AI_RECENT_ISSUES_LIMIT,
  AI_SUPPORTED_ACTIONS,
  AI_TEMPERATURE,
  AI_TIMEOUT_MS,
  AI_TRIAGE_DUPLICATE_LABEL,
  AI_TRIAGE_MONITOR_LABEL,
} from '../constants/ai-triage.constants';
import type { GovernanceGateway } from '../ports/governance-gateway.port';
import type { IssueHistoryGateway } from '../ports/issue-history-gateway.port';
import type { LLMGateway } from '../../../../shared/application/ports/llm-gateway.port';

const AI_SYSTEM_PROMPT =
  'You are an issue triage assistant. Return valid JSON only and do not include markdown.';

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
  error: (message: string, ...args: unknown[]) => void;
}

interface Dependencies {
  llmGateway: LLMGateway;
  issueHistoryGateway: IssueHistoryGateway;
  governanceGateway: GovernanceGateway;
  logger?: Logger;
}

type AiIssueKind = 'bug' | 'feature' | 'question';
type AiTone = 'positive' | 'neutral' | 'hostile';

interface AiAnalysis {
  classification: {
    type: AiIssueKind;
    confidence: number;
    reasoning: string;
  };
  duplicateDetection: {
    isDuplicate: boolean;
    originalIssueNumber: number | null;
    similarityScore: number;
  };
  sentiment: {
    tone: AiTone;
    reasoning: string;
  };
}

const isSupportedAction = (action: string): action is AiSupportedAction =>
  AI_SUPPORTED_ACTIONS.includes(action as AiSupportedAction);

const buildUserPrompt = (input: {
  issueTitle: string;
  issueBody: string;
  recentIssues: { number: number; title: string }[];
}): string => {
  const recentIssuesBlock = input.recentIssues
    .map((recentIssue) => `#${recentIssue.number}: ${recentIssue.title}`)
    .join('\n');

  return [
    `Issue title: ${input.issueTitle}`,
    `Issue body: ${input.issueBody}`,
    'Recent issues:',
    recentIssuesBlock || '(none)',
    'Return a JSON object with classification, duplicate detection and tone fields.',
  ].join('\n');
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object';

const isConfidence = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

const isAiIssueKind = (value: unknown): value is AiIssueKind =>
  value === 'bug' || value === 'feature' || value === 'question';

const isAiTone = (value: unknown): value is AiTone =>
  value === 'positive' || value === 'neutral' || value === 'hostile';

const isAiAnalysis = (value: unknown): value is AiAnalysis => {
  if (!isObjectRecord(value)) {
    return false;
  }

  const classification = value.classification;
  const duplicateDetection = value.duplicateDetection;
  const sentiment = value.sentiment;

  if (!isObjectRecord(classification) || !isObjectRecord(duplicateDetection) || !isObjectRecord(sentiment)) {
    return false;
  }

  const isValidClassification =
    isAiIssueKind(classification.type) &&
    isConfidence(classification.confidence) &&
    typeof classification.reasoning === 'string';

  const isValidDuplicateDetection =
    typeof duplicateDetection.isDuplicate === 'boolean' &&
    (duplicateDetection.originalIssueNumber === null ||
      typeof duplicateDetection.originalIssueNumber === 'number') &&
    isConfidence(duplicateDetection.similarityScore);

  const isValidSentiment = isAiTone(sentiment.tone) && typeof sentiment.reasoning === 'string';

  return isValidClassification && isValidDuplicateDetection && isValidSentiment;
};

const parseAiAnalysis = (rawText: string): AiAnalysis | undefined => {
  try {
    const parsed: unknown = JSON.parse(rawText);
    return isAiAnalysis(parsed) ? parsed : undefined;
  } catch (_error: unknown) {
    return undefined;
  }
};

const mapKindToLabel = (kind: AiIssueKind): string => {
  if (kind === 'bug') {
    return AI_KIND_BUG_LABEL;
  }

  if (kind === 'feature') {
    return AI_KIND_FEATURE_LABEL;
  }

  return AI_KIND_QUESTION_LABEL;
};

const buildDuplicateComment = (originalIssueNumber: number, similarityScore: number): string =>
  `${AI_DUPLICATE_COMMENT_PREFIX}${originalIssueNumber} (Similarity: ${Math.round(similarityScore * 100)}%).`;

export const analyzeIssueWithAi =
  ({ llmGateway, issueHistoryGateway, governanceGateway, logger = console }: Dependencies) =>
  async (input: AnalyzeIssueWithAiInput): Promise<AnalyzeIssueWithAiResult> => {
    if (!isSupportedAction(input.action)) {
      return { status: 'skipped', reason: 'unsupported_action' };
    }

    try {
      const recentIssues = await issueHistoryGateway.findRecentIssues({
        repositoryFullName: input.repositoryFullName,
        limit: AI_RECENT_ISSUES_LIMIT,
      });

      const llmResult = await llmGateway.generateJson({
        systemPrompt: AI_SYSTEM_PROMPT,
        userPrompt: buildUserPrompt({
          issueTitle: input.issue.title,
          issueBody: input.issue.body,
          recentIssues: recentIssues.map((recentIssue) => ({
            number: recentIssue.number,
            title: recentIssue.title,
          })),
        }),
        maxTokens: AI_MAX_TOKENS,
        timeoutMs: AI_TIMEOUT_MS,
        temperature: AI_TEMPERATURE,
      });

      const aiAnalysis = parseAiAnalysis(llmResult.rawText);
      if (!aiAnalysis) {
        logger.error('AnalyzeIssueWithAiUseCase failed parsing AI response. Applying fail-open policy.', {
          repositoryFullName: input.repositoryFullName,
          issueNumber: input.issue.number,
          rawText: llmResult.rawText,
        });
        return { status: 'skipped', reason: 'ai_unavailable' };
      }

      const issueLabels = new Set(input.issue.labels);
      const addLabelIfMissing = async (label: string): Promise<boolean> => {
        if (issueLabels.has(label)) {
          return false;
        }

        await governanceGateway.addLabels({
          repositoryFullName: input.repositoryFullName,
          issueNumber: input.issue.number,
          labels: [label],
        });
        issueLabels.add(label);
        return true;
      };

      const removeLabelIfPresent = async (label: string): Promise<void> => {
        await governanceGateway.removeLabel({
          repositoryFullName: input.repositoryFullName,
          issueNumber: input.issue.number,
          label,
        });
        issueLabels.delete(label);
      };

      if (aiAnalysis.classification.confidence >= AI_CLASSIFICATION_CONFIDENCE_THRESHOLD) {
        const targetKindLabel = mapKindToLabel(aiAnalysis.classification.type);
        const labelsToRemove = AI_KIND_LABELS.filter(
          (label) => label !== targetKindLabel && issueLabels.has(label),
        );

        for (const labelToRemove of labelsToRemove) {
          await removeLabelIfPresent(labelToRemove);
        }

        await addLabelIfMissing(targetKindLabel);
      }

      if (
        aiAnalysis.duplicateDetection.isDuplicate &&
        aiAnalysis.duplicateDetection.originalIssueNumber !== null &&
        aiAnalysis.duplicateDetection.similarityScore >= AI_DUPLICATE_SIMILARITY_THRESHOLD
      ) {
        const wasDuplicateLabelAdded = await addLabelIfMissing(AI_TRIAGE_DUPLICATE_LABEL);

        if (wasDuplicateLabelAdded) {
          await governanceGateway.createComment({
            repositoryFullName: input.repositoryFullName,
            issueNumber: input.issue.number,
            body: buildDuplicateComment(
              aiAnalysis.duplicateDetection.originalIssueNumber,
              aiAnalysis.duplicateDetection.similarityScore,
            ),
          });
        }
      }

      if (aiAnalysis.sentiment.tone === 'hostile') {
        await addLabelIfMissing(AI_TRIAGE_MONITOR_LABEL);
      }

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
