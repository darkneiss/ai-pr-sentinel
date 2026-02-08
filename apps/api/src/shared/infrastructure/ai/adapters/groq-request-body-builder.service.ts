import {
  RESPONSE_SCHEMA,
  STRUCTURED_OUTPUT_SCHEMA_NAME,
} from './groq-adapter.constants';

export const buildGroqRequestBody = ({
  systemPrompt,
  userPrompt,
  model,
  maxTokens,
  temperature,
  includeStructuredOutput,
}: {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  maxTokens: number;
  temperature?: number;
  includeStructuredOutput: boolean;
}): Record<string, unknown> => {
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_completion_tokens: maxTokens,
    temperature,
  };

  if (includeStructuredOutput) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: STRUCTURED_OUTPUT_SCHEMA_NAME,
        schema: RESPONSE_SCHEMA,
      },
    };
  }

  return body;
};
