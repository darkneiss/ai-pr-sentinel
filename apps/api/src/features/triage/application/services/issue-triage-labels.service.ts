import {
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
