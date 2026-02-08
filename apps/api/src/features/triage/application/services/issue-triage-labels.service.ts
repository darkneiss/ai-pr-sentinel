import {
  AI_DUPLICATE_COMMENT_PREFIX,
  AI_KIND_BUG_LABEL,
  AI_KIND_FEATURE_LABEL,
  AI_KIND_QUESTION_LABEL,
} from '../constants/ai-triage.constants';
import type { AiIssueKind } from './ai-analysis-normalizer.service';

export const mapKindToLabel = (kind: AiIssueKind): string => {
  if (kind === 'bug') {
    return AI_KIND_BUG_LABEL;
  }

  if (kind === 'feature') {
    return AI_KIND_FEATURE_LABEL;
  }

  return AI_KIND_QUESTION_LABEL;
};

export const buildDuplicateComment = (originalIssueNumber: number, similarityScore: number): string =>
  `${AI_DUPLICATE_COMMENT_PREFIX}${originalIssueNumber} (Similarity: ${Math.round(similarityScore * 100)}%).`;
