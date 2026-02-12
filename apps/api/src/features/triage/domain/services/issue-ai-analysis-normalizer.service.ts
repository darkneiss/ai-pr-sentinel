import { normalizeLegacyAiAnalysis } from './issue-ai-analysis-legacy-normalizer.service';
import { isAiAnalysis } from './issue-ai-analysis-shape-guards.service';
import { normalizeStructuredAiAnalysis } from './issue-ai-analysis-structured-normalizer.service';
import { isObjectRecord } from './issue-ai-analysis.types';

export type { AiAnalysis, AiIssueKind, AiTone } from './issue-ai-analysis.types';

export const parseAiAnalysis = (rawText: string, currentIssueNumber: number) => {
  try {
    const parsed: unknown = JSON.parse(rawText);
    if (isAiAnalysis(parsed)) {
      return parsed;
    }

    if (isObjectRecord(parsed)) {
      const normalizedStructuredAiAnalysis = normalizeStructuredAiAnalysis(parsed, currentIssueNumber);
      if (normalizedStructuredAiAnalysis) {
        return normalizedStructuredAiAnalysis;
      }

      return normalizeLegacyAiAnalysis(parsed, currentIssueNumber);
    }

    return undefined;
  } catch (_error: unknown) {
    return undefined;
  }
};
