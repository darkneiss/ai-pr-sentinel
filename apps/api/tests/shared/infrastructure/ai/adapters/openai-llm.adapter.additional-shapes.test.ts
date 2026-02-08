import { createOpenAiLlmAdapter } from '../../../../../src/shared/infrastructure/ai/adapters/openai-llm.adapter';

interface MockFetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

describe('OpenAiLlmAdapter (Additional Shapes)', () => {
  it('should extract text when message.content is an object with text', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: { type: 'output_text', text: '{"classification":{"type":"feature"}}' },
            },
          },
        ],
      }),
    });
    const adapter = createOpenAiLlmAdapter({
      apiKey: 'openai-key',
      model: 'test-model',
      baseUrl: 'https://api.test',
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
    expect(result).toEqual({ rawText: '{"classification":{"type":"feature"}}' });
  });

  it('should extract text from choices[0].text fallback', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            text: '{"classification":{"type":"bug"}}',
          },
        ],
      }),
    });
    const adapter = createOpenAiLlmAdapter({
      apiKey: 'openai-key',
      model: 'test-model',
      baseUrl: 'https://api.test',
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

  it('should include response_shape summary when content is missing', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      }),
    });
    const adapter = createOpenAiLlmAdapter({
      apiKey: 'openai-key',
      model: 'test-model',
      baseUrl: 'https://api.test',
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
    ).rejects.toThrow('response_shape=choices=1; first_choice_keys=message; content_type=null');
  });

  it('should include array response_shape when array content does not provide text', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: [{ type: 'output_text' }],
            },
          },
        ],
      }),
    });
    const adapter = createOpenAiLlmAdapter({
      apiKey: 'openai-key',
      model: 'test-model',
      baseUrl: 'https://api.test',
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
    ).rejects.toThrow('response_shape=choices=1; first_choice_keys=message; content_type=array');
  });

  it('should include empty-choice response_shape when provider returns no choices', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    const adapter = createOpenAiLlmAdapter({
      apiKey: 'openai-key',
      model: 'test-model',
      baseUrl: 'https://api.test',
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
    ).rejects.toThrow('response_shape=choices=0; first_choice_keys=none; content_type=undefined');
  });
});
