export const DEFAULT_GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
export const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';
export const LLM_API_KEY_ENV_VAR = 'LLM_API_KEY';
export const LLM_MODEL_ENV_VAR = 'LLM_MODEL';
export const LLM_BASE_URL_ENV_VAR = 'LLM_BASE_URL';
export const GROQ_API_KEY_ENV_VAR = 'GROQ_API_KEY';
export const GROQ_MODEL_ENV_VAR = 'GROQ_MODEL';
export const GROQ_BASE_URL_ENV_VAR = 'GROQ_BASE_URL';
export const CHAT_COMPLETIONS_PATH = '/chat/completions';
export const JSON_VALIDATION_ERROR_FRAGMENT = 'Failed to validate JSON';
export const STRUCTURED_OUTPUT_SCHEMA_NAME = 'issue_triage_response';

export const RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: true,
  required: ['classification', 'duplicateDetection', 'sentiment'],
  properties: {
    classification: {
      type: 'object',
      additionalProperties: true,
      required: ['type', 'confidence'],
      properties: {
        type: { type: 'string' },
        confidence: { type: 'number' },
        reasoning: { type: 'string' },
      },
    },
    duplicateDetection: {
      type: 'object',
      additionalProperties: true,
      required: ['isDuplicate', 'similarityScore'],
      properties: {
        isDuplicate: { type: 'boolean' },
        originalIssueNumber: { type: ['number', 'null'] },
        similarityScore: { type: 'number' },
      },
    },
    sentiment: {
      type: 'object',
      additionalProperties: true,
      required: ['tone', 'confidence'],
      properties: {
        tone: { type: 'string' },
        confidence: { type: 'number' },
        reasoning: { type: 'string' },
      },
    },
    suggestedResponse: {
      anyOf: [
        { type: 'string' },
        {
          type: 'array',
          items: { type: 'string' },
        },
      ],
    },
  },
};
