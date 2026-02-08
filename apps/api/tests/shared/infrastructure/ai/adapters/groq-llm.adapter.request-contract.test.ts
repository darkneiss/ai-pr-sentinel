import { createGroqLlmAdapter } from '../../../../../src/shared/infrastructure/ai/adapters/groq-llm.adapter';

interface MockFetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

describe('GroqLlmAdapter (Request Contract)', () => {
  it('should send max_completion_tokens and json_schema structured output', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"ok":true}' } }],
      }),
    });

    const adapter = createGroqLlmAdapter({
      apiKey: 'groq-key',
      model: 'llama-3.3-70b-versatile',
      baseUrl: 'https://api.groq.com/openai',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act
    await adapter.generateJson({
      systemPrompt: 'system',
      userPrompt: 'user',
      maxTokens: 321,
      timeoutMs: 5000,
      temperature: 0.2,
    });

    // Assert
    const firstCallBody = fetchFn.mock.calls[0]?.[1]?.body as string;
    expect(firstCallBody).toContain('"max_completion_tokens":321');
    expect(firstCallBody).not.toContain('"max_tokens"');
    expect(firstCallBody).toContain('"response_format":{"type":"json_schema"');
  });
});
