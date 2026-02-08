import {
  AI_CLASSIFICATION_CONFIDENCE_THRESHOLD,
  AI_DUPLICATE_COMMENT_PREFIX,
  AI_DUPLICATE_SIMILARITY_THRESHOLD,
  AI_KIND_BUG_LABEL,
  AI_KIND_FEATURE_LABEL,
  AI_KIND_LABELS,
  AI_KIND_QUESTION_LABEL,
  AI_MAX_TOKENS,
  AI_QUESTION_REPLY_COMMENT_PREFIX,
  AI_QUESTION_FALLBACK_CHECKLIST,
  AI_QUESTION_SIGNAL_KEYWORDS,
  AI_RECENT_ISSUES_LIMIT,
  AI_SUPPORTED_ACTIONS,
  AI_TEMPERATURE,
  AI_TIMEOUT_MS,
  AI_TRIAGE_DUPLICATE_LABEL,
  AI_TRIAGE_MONITOR_LABEL,
} from '../constants/ai-triage.constants';
import type { GovernanceGateway } from '../ports/governance-gateway.port';
import type { IssueHistoryGateway } from '../ports/issue-history-gateway.port';
import type { RepositoryContextGateway } from '../ports/repository-context-gateway.port';
import type { LLMGateway } from '../../../../shared/application/ports/llm-gateway.port';
import type {
  QuestionResponseMetricsPort,
  QuestionResponseSource,
} from '../../../../shared/application/ports/question-response-metrics.port';
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
  suggestedResponse?: string;
}

const isSupportedAction = (action: string): action is AiSupportedAction =>
  AI_SUPPORTED_ACTIONS.includes(action as AiSupportedAction);

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object';

const isConfidence = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

const isAiIssueKind = (value: unknown): value is AiIssueKind =>
  value === 'bug' || value === 'feature' || value === 'question';

const isAiTone = (value: unknown): value is AiTone =>
  value === 'positive' || value === 'neutral' || value === 'hostile';

const normalizeAiIssueKind = (value: unknown): AiIssueKind | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === 'bug') {
    return 'bug';
  }

  if (normalizedValue === 'feature') {
    return 'feature';
  }

  if (normalizedValue === 'question') {
    return 'question';
  }

  return undefined;
};

const normalizeAiTone = (value: unknown): AiTone | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === 'hostile' || normalizedValue === 'aggressive') {
    return 'hostile';
  }

  if (normalizedValue === 'positive') {
    return 'positive';
  }

  if (normalizedValue === 'neutral') {
    return 'neutral';
  }

  return undefined;
};

const parseIssueNumberFromReference = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value > 0 ? value : null;
  }

  if (typeof value === 'string') {
    const exactParsedNumber = Number(value.replace('#', '').trim());
    if (Number.isInteger(exactParsedNumber) && exactParsedNumber > 0) {
      return exactParsedNumber;
    }

    const numericMatch = value.match(/#?\s*(\d+)/);
    const extractedNumber = numericMatch?.[1] ? Number(numericMatch[1]) : Number.NaN;
    if (Number.isInteger(extractedNumber) && extractedNumber > 0) {
      return extractedNumber;
    }
  }

  if (isObjectRecord(value)) {
    const nestedIssueNumber =
      parseIssueNumberFromReference(value.number) ??
      parseIssueNumberFromReference(value.issueNumber) ??
      parseIssueNumberFromReference(value.id) ??
      parseIssueNumberFromReference(value.originalIssueNumber);
    if (nestedIssueNumber !== null) {
      return nestedIssueNumber;
    }
  }

  return null;
};

const normalizeSuggestedResponse = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    return normalizedValue.length > 0 ? normalizedValue : undefined;
  }

  if (Array.isArray(value)) {
    const normalizedLines = value
      .filter((item): item is string => typeof item === 'string')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (normalizedLines.length > 0) {
      return normalizedLines.join('\n');
    }
  }

  return undefined;
};

const parseFirstValidDuplicateIssue = (
  duplicateOf: unknown,
  currentIssueNumber: number,
): number | null => {
  const duplicateReferences = Array.isArray(duplicateOf) ? duplicateOf : [duplicateOf];

  for (const duplicateReference of duplicateReferences) {
    const parsedIssueNumber = parseIssueNumberFromReference(duplicateReference);
    if (parsedIssueNumber !== null && parsedIssueNumber !== currentIssueNumber) {
      return parsedIssueNumber;
    }
  }

  return null;
};

const isValidOriginalIssueNumber = (
  originalIssueNumber: number | null,
  currentIssueNumber: number,
): originalIssueNumber is number =>
  originalIssueNumber !== null && originalIssueNumber !== currentIssueNumber;

const normalizeAiAnalysis = (value: unknown, currentIssueNumber: number): AiAnalysis | undefined => {
  if (!isObjectRecord(value)) {
    return undefined;
  }

  const legacyClassification = normalizeAiIssueKind(value.classification);
  const legacyTone = normalizeAiTone(value.tone);
  const duplicateDetectionRaw = isObjectRecord(value.duplicate_detection)
    ? value.duplicate_detection
    : undefined;
  const explicitLegacyOriginalIssue =
    parseIssueNumberFromReference(duplicateDetectionRaw?.original_issue_number) ??
    parseIssueNumberFromReference(duplicateDetectionRaw?.originalIssueNumber);
  const legacyDuplicateIssueNumber = parseFirstValidDuplicateIssue(
    explicitLegacyOriginalIssue ?? duplicateDetectionRaw?.duplicate_of,
    currentIssueNumber,
  );
  const isLegacyDuplicate = duplicateDetectionRaw?.is_duplicate === true;
  const hasLegacyShape = typeof value.tone === 'string' || !!duplicateDetectionRaw;

  if (hasLegacyShape) {
    return {
      classification: {
        type: legacyClassification ?? 'bug',
        confidence: legacyClassification ? 1 : 0,
        reasoning: typeof value.reasoning === 'string' ? value.reasoning : 'Legacy-format AI response',
      },
      duplicateDetection: {
        isDuplicate: isLegacyDuplicate,
        originalIssueNumber: legacyDuplicateIssueNumber,
        similarityScore: isLegacyDuplicate ? 1 : 0,
      },
      sentiment: {
        tone: legacyTone ?? 'neutral',
        reasoning: 'Legacy-format AI response',
      },
      suggestedResponse:
        typeof value.suggested_response === 'string'
          ? value.suggested_response
          : typeof value.suggestedResponse === 'string'
            ? value.suggestedResponse
            : undefined,
    };
  }

  return undefined;
};

const normalizeStructuredAiAnalysis = (
  value: unknown,
  currentIssueNumber: number,
): AiAnalysis | undefined => {
  if (!isObjectRecord(value)) {
    return undefined;
  }

  const classificationRaw = isObjectRecord(value.classification) ? value.classification : undefined;
  const duplicateDetectionRaw = isObjectRecord(value.duplicateDetection)
    ? value.duplicateDetection
    : undefined;
  const sentimentRaw = isObjectRecord(value.sentiment) ? value.sentiment : undefined;

  if (!classificationRaw || !duplicateDetectionRaw || !sentimentRaw) {
    return undefined;
  }

  const normalizedClassificationType = normalizeAiIssueKind(classificationRaw.type);
  const normalizedClassificationConfidence = isConfidence(classificationRaw.confidence)
    ? classificationRaw.confidence
    : normalizedClassificationType
      ? 1
      : 0;
  const normalizedOriginalIssueNumber =
    parseIssueNumberFromReference(duplicateDetectionRaw.originalIssueNumber) ??
    parseIssueNumberFromReference(duplicateDetectionRaw.duplicateIssueId) ??
    parseIssueNumberFromReference(duplicateDetectionRaw.original_issue_number) ??
    parseFirstValidDuplicateIssue(duplicateDetectionRaw.duplicate_of, currentIssueNumber);
  const isDuplicate = duplicateDetectionRaw.isDuplicate === true;
  const normalizedSimilarityScore = isConfidence(duplicateDetectionRaw.similarityScore)
    ? duplicateDetectionRaw.similarityScore
    : isDuplicate
      ? 1
      : 0;
  const normalizedTone = normalizeAiTone(sentimentRaw.tone) ?? 'neutral';

  return {
    classification: {
      type: normalizedClassificationType ?? 'bug',
      confidence: normalizedClassificationConfidence,
      reasoning:
        typeof classificationRaw.reasoning === 'string'
          ? classificationRaw.reasoning
          : 'Structured-format AI response',
    },
    duplicateDetection: {
      isDuplicate,
      originalIssueNumber: normalizedOriginalIssueNumber,
      similarityScore: normalizedSimilarityScore,
    },
    sentiment: {
      tone: normalizedTone,
      reasoning:
        typeof sentimentRaw.reasoning === 'string' ? sentimentRaw.reasoning : 'Structured-format AI response',
    },
    suggestedResponse:
      normalizeSuggestedResponse(value.suggestedResponse) ?? normalizeSuggestedResponse(value.suggested_response),
  };
};

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
  const isValidSuggestedResponse =
    value.suggestedResponse === undefined ||
    value.suggestedResponse === null ||
    typeof value.suggestedResponse === 'string';

  return isValidClassification && isValidDuplicateDetection && isValidSentiment && isValidSuggestedResponse;
};

const parseAiAnalysis = (rawText: string, currentIssueNumber: number): AiAnalysis | undefined => {
  try {
    const parsed: unknown = JSON.parse(rawText);
    if (isAiAnalysis(parsed)) {
      return parsed;
    }

    const normalizedStructuredAiAnalysis = normalizeStructuredAiAnalysis(parsed, currentIssueNumber);
    if (normalizedStructuredAiAnalysis) {
      return normalizedStructuredAiAnalysis;
    }

    return normalizeAiAnalysis(parsed, currentIssueNumber);
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

const isLikelyQuestionIssue = (title: string, body: string): boolean => {
  const normalizedText = `${title}\n${body}`.toLowerCase();
  if (normalizedText.includes('?') || normalizedText.includes('¿')) {
    return true;
  }

  return AI_QUESTION_SIGNAL_KEYWORDS.some((keyword) => normalizedText.includes(keyword));
};

const buildFallbackQuestionResponse = (): string => AI_QUESTION_FALLBACK_CHECKLIST.join('\n');

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
        },
        hasSuggestedResponse:
          typeof aiAnalysis.suggestedResponse === 'string' && aiAnalysis.suggestedResponse.trim().length > 0,
      });

      const issueLabels = new Set(input.issue.labels);
      let actionsAppliedCount = 0;
      const addLabelIfMissing = async (label: string): Promise<boolean> => {
        if (issueLabels.has(label)) {
          logger.debug?.('AnalyzeIssueWithAiUseCase label already present. Skipping add.', {
            repositoryFullName: input.repositoryFullName,
            issueNumber: input.issue.number,
            label,
          });
          return false;
        }

        await governanceGateway.addLabels({
          repositoryFullName: input.repositoryFullName,
          issueNumber: input.issue.number,
          labels: [label],
        });
        issueLabels.add(label);
        actionsAppliedCount += 1;
        logger.debug?.('AnalyzeIssueWithAiUseCase label added.', {
          repositoryFullName: input.repositoryFullName,
          issueNumber: input.issue.number,
          label,
        });
        return true;
      };

      const removeLabelIfPresent = async (label: string): Promise<void> => {
        await governanceGateway.removeLabel({
          repositoryFullName: input.repositoryFullName,
          issueNumber: input.issue.number,
          label,
        });
        issueLabels.delete(label);
        actionsAppliedCount += 1;
        logger.debug?.('AnalyzeIssueWithAiUseCase label removed.', {
          repositoryFullName: input.repositoryFullName,
          issueNumber: input.issue.number,
          label,
        });
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

      if (aiAnalysis.duplicateDetection.isDuplicate) {
        const originalIssueNumber = aiAnalysis.duplicateDetection.originalIssueNumber;
        const hasValidOriginalIssue = isValidOriginalIssueNumber(
          originalIssueNumber,
          input.issue.number,
        );
        const hasSimilarityScore =
          aiAnalysis.duplicateDetection.similarityScore >= AI_DUPLICATE_SIMILARITY_THRESHOLD;

        if (!hasValidOriginalIssue || !hasSimilarityScore) {
          logger.info?.('AnalyzeIssueWithAiUseCase duplicate detection skipped.', {
            repositoryFullName: input.repositoryFullName,
            issueNumber: input.issue.number,
            originalIssueNumber: aiAnalysis.duplicateDetection.originalIssueNumber,
            similarityScore: aiAnalysis.duplicateDetection.similarityScore,
            hasValidOriginalIssue,
            hasSimilarityScore,
          });
        } else {
          const wasDuplicateLabelAdded = await addLabelIfMissing(AI_TRIAGE_DUPLICATE_LABEL);

          if (wasDuplicateLabelAdded) {
            await governanceGateway.createComment({
              repositoryFullName: input.repositoryFullName,
              issueNumber: input.issue.number,
              body: buildDuplicateComment(
                originalIssueNumber,
                aiAnalysis.duplicateDetection.similarityScore,
              ),
            });
            actionsAppliedCount += 1;
            logger.debug?.('AnalyzeIssueWithAiUseCase duplicate comment created.', {
              repositoryFullName: input.repositoryFullName,
              issueNumber: input.issue.number,
              originalIssueNumber,
              similarityScore: aiAnalysis.duplicateDetection.similarityScore,
            });
          }
        }
      }

      if (aiAnalysis.sentiment.tone === 'hostile') {
        await addLabelIfMissing(AI_TRIAGE_MONITOR_LABEL);
      }

      const normalizedSuggestedResponse =
        typeof aiAnalysis.suggestedResponse === 'string' ? aiAnalysis.suggestedResponse.trim() : '';
      const hasHighConfidenceQuestionClassification =
        aiAnalysis.classification.type === 'question' &&
        aiAnalysis.classification.confidence >= AI_CLASSIFICATION_CONFIDENCE_THRESHOLD;
      const looksLikeQuestionIssue = isLikelyQuestionIssue(input.issue.title, input.issue.body);
      const fallbackQuestionResponse = looksLikeQuestionIssue ? buildFallbackQuestionResponse() : '';
      const effectiveQuestionResponse = normalizedSuggestedResponse || fallbackQuestionResponse;
      const shouldCreateQuestionResponseComment =
        input.action === 'opened' &&
        (hasHighConfidenceQuestionClassification || looksLikeQuestionIssue) &&
        effectiveQuestionResponse.length > 0;

      if (shouldCreateQuestionResponseComment) {
        const responseSource: QuestionResponseSource =
          normalizedSuggestedResponse.length > 0 ? 'ai_suggested_response' : 'fallback_checklist';
        questionResponseMetrics?.increment(responseSource);
        const responseSourceMetricsSnapshot = questionResponseMetrics?.snapshot();
        logger.info?.('AnalyzeIssueWithAiUseCase question response source selected.', {
          repositoryFullName: input.repositoryFullName,
          issueNumber: input.issue.number,
          responseSource,
          metrics: responseSourceMetricsSnapshot,
        });
        const hasExistingQuestionReplyComment = await issueHistoryGateway.hasIssueCommentWithPrefix({
          repositoryFullName: input.repositoryFullName,
          issueNumber: input.issue.number,
          bodyPrefix: AI_QUESTION_REPLY_COMMENT_PREFIX,
          authorLogin: botLogin,
        });

        if (hasExistingQuestionReplyComment) {
          logger.debug?.('AnalyzeIssueWithAiUseCase question reply comment already exists. Skipping.', {
            repositoryFullName: input.repositoryFullName,
            issueNumber: input.issue.number,
            bodyPrefix: AI_QUESTION_REPLY_COMMENT_PREFIX,
            authorLogin: botLogin,
          });
        } else {
          await governanceGateway.createComment({
            repositoryFullName: input.repositoryFullName,
            issueNumber: input.issue.number,
            body: `${AI_QUESTION_REPLY_COMMENT_PREFIX}\n\n${effectiveQuestionResponse}`,
          });
          actionsAppliedCount += 1;
          logger.debug?.('AnalyzeIssueWithAiUseCase question reply comment created.', {
            repositoryFullName: input.repositoryFullName,
            issueNumber: input.issue.number,
            bodyPrefix: AI_QUESTION_REPLY_COMMENT_PREFIX,
            responseSource,
          });
        }
      }

      if (actionsAppliedCount === 0) {
        logger.debug?.('AnalyzeIssueWithAiUseCase no governance actions were applied.', {
          repositoryFullName: input.repositoryFullName,
          issueNumber: input.issue.number,
          action: input.action,
        });
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
