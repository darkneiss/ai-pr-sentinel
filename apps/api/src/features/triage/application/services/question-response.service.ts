import { AI_QUESTION_FALLBACK_CHECKLIST } from '../constants/ai-triage.constants';

const CONTEXT_STOP_WORDS = new Set([
  'this',
  'that',
  'with',
  'from',
  'have',
  'your',
  'about',
  'into',
  'there',
  'which',
  'when',
  'where',
  'what',
  'how',
  'for',
  'and',
  'the',
  'are',
  'you',
  'repo',
  'readme',
  'issue',
  'setup',
  'checklist',
]);

const extractMeaningfulTokens = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 5 && !CONTEXT_STOP_WORDS.has(token));

export const buildFallbackQuestionResponse = (): string => AI_QUESTION_FALLBACK_CHECKLIST.join('\n');

export const detectRepositoryContextUsage = (
  suggestedResponse: string,
  repositoryReadme: string | undefined,
): boolean => {
  if (!repositoryReadme || repositoryReadme.trim().length === 0) {
    return false;
  }

  const contextTokens = new Set(extractMeaningfulTokens(repositoryReadme));
  if (contextTokens.size === 0) {
    return false;
  }

  let overlapCount = 0;
  for (const responseToken of extractMeaningfulTokens(suggestedResponse)) {
    if (contextTokens.has(responseToken)) {
      overlapCount += 1;
      if (overlapCount >= 2) {
        return true;
      }
    }
  }

  return false;
};
