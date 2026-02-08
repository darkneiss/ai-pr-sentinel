import { createOpenAiLlmAdapter } from '../../../../../src/shared/infrastructure/ai/adapters/openai-llm.adapter';

interface MockFetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

describe('OpenAiLlmAdapter (Response Shape)', () => {
  it('should extract text when message.content is an array of parts', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: [
                { type: 'text', text: '{"classification":' },
                { type: 'text', text: '{"type":"bug"}}' },
              ],
            },
          },
        ],
      }),
    });
    const adapter = createOpenAiLlmAdapter({
      apiKey: 'openai-key',
      model: 'groq-model',
      baseUrl: 'https://api.groq.com/openai',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act
    const result = await adapter.generateJson({
      systemPrompt: 'system',
      userPrompt: 'user',
      maxTokens: 128,
      timeoutMs: 5000,
    });

    // Assert
    expect(result).toEqual({ rawText: '{"classification":{"type":"bug"}}' });
  });

  it('should throw enriched error when response is ok but text content is missing', async () => {
    // Arrange
    const model = 'groq-model';
    const baseUrl = 'https://api.groq.com/openai';
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'cmpl-123',
        choices: [{ message: { content: null } }],
      }),
    });
    const adapter = createOpenAiLlmAdapter({
      apiKey: 'openai-key',
      model,
      baseUrl,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act + Assert
    await expect(
      adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 128,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow(
      `OpenAI response did not include text content for model ${model} at ${baseUrl}/v1/chat/completions`,
    );
  });
});
