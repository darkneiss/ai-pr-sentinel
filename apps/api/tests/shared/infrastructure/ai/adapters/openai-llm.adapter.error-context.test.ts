import { createOpenAiLlmAdapter } from '../../../../../src/shared/infrastructure/ai/adapters/openai-llm.adapter';

interface MockFetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

describe('OpenAiLlmAdapter (Error Context)', () => {
  it('should include endpoint and model when provider returns non-ok response', async () => {
    // Arrange
    const apiKey = 'secret-api-key';
    const baseUrl = 'https://api.groq.com';
    const model = 'llama3-70b-8192';
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        error: {
          message: 'Unknown request URL: POST /openai/v1/models/llama3-70b-8192:generateContent',
        },
      }),
    });
    const adapter = createOpenAiLlmAdapter({
      apiKey,
      baseUrl,
      model,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act + Assert
    await expect(
      adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 100,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow(
      `OpenAI request failed with status 404 for model ${model} at ${baseUrl}/v1/chat/completions`,
    );
    await expect(
      adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 100,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow('Unknown request URL');
    await expect(
      adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 100,
        timeoutMs: 5000,
      }),
    ).rejects.not.toThrow(apiKey);
  });
});
