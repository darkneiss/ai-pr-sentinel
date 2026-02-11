import { AI_QUESTION_FALLBACK_CHECKLIST } from '../constants/ai-triage.constants';

export const buildFallbackQuestionResponse = (): string => AI_QUESTION_FALLBACK_CHECKLIST.join('\n');
