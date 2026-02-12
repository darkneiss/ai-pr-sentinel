export type AiIssueKind = 'bug' | 'feature' | 'question';
export type AiTone = 'positive' | 'neutral' | 'hostile';

export interface AiLabelRecommendation {
  shouldApply: boolean;
  confidence: number;
  reasoning?: string;
}

export interface AiLabelRecommendations {
  documentation?: AiLabelRecommendation;
  helpWanted?: AiLabelRecommendation;
  goodFirstIssue?: AiLabelRecommendation;
}

export interface AiAnalysis {
  classification: {
    type: AiIssueKind;
    confidence: number;
    reasoning: string;
  };
  duplicateDetection: {
    isDuplicate: boolean;
    originalIssueNumber: number | null;
    similarityScore: number;
    hasExplicitOriginalIssueReference?: boolean;
  };
  sentiment: {
    tone: AiTone;
    confidence: number;
    reasoning: string;
  };
  labelRecommendations?: AiLabelRecommendations;
  suggestedResponse?: string;
}

export const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object';

export const isConfidence = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

export const isAiIssueKind = (value: unknown): value is AiIssueKind =>
  value === 'bug' || value === 'feature' || value === 'question';

export const isAiTone = (value: unknown): value is AiTone =>
  value === 'positive' || value === 'neutral' || value === 'hostile';

export const normalizeAiIssueKind = (value: unknown): AiIssueKind | undefined => {
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

export const normalizeAiTone = (value: unknown): AiTone | undefined => {
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
