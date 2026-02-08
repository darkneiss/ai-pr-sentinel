import { createGroqLlmAdapter } from '../../../../../src/shared/infrastructure/ai/adapters/groq-llm.adapter';

interface MockFetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

describe('GroqLlmAdapter', () => {
  it('should call Groq chat completions and return raw text', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"classification":{"type":"question"}}',
            },
          },
        ],
      }),
    });

    const adapter = createGroqLlmAdapter({
      apiKey: 'groq-key',
      model: 'llama-3.3-70b-versatile',
      baseUrl: 'https://api.groq.com/openai',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act
    const result = await adapter.generateJson({
      systemPrompt: 'system',
      userPrompt: 'user',
      maxTokens: 200,
      timeoutMs: 5000,
      temperature: 0.2,
    });

    // Assert
    expect(result).toEqual({ rawText: '{"classification":{"type":"question"}}' });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer groq-key',
        }),
        body: expect.stringContaining('"model":"llama-3.3-70b-versatile"'),
      }),
    );
  });

  it('should throw enriched provider error when response is non-ok', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        error: { message: 'Unknown request URL' },
      }),
    });

    const adapter = createGroqLlmAdapter({
      apiKey: 'groq-key',
      model: 'llama-3.3-70b-versatile',
      baseUrl: 'https://api.groq.com/openai',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act + Assert
    await expect(
      adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 200,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow(
      'Groq request failed with status 404 for model llama-3.3-70b-versatile at https://api.groq.com/openai/v1/chat/completions: Unknown request URL',
    );
  });

  it('should throw when API key is missing', () => {
    // Arrange
    const previousGroqApiKey = process.env.GROQ_API_KEY;
    const previousLlmApiKey = process.env.LLM_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.LLM_API_KEY;

    try {
      // Act + Assert
      expect(() => createGroqLlmAdapter()).toThrow(
        'Missing Groq API key. Provide "apiKey" or set GROQ_API_KEY',
      );
    } finally {
      process.env.GROQ_API_KEY = previousGroqApiKey;
      process.env.LLM_API_KEY = previousLlmApiKey;
    }
  });

  it('should keep chat completions endpoint when baseUrl already points to /chat/completions', async () => {
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
      baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act
    await adapter.generateJson({
      systemPrompt: 'system',
      userPrompt: 'user',
      maxTokens: 200,
      timeoutMs: 5000,
    });

    // Assert
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      expect.any(Object),
    );
  });

  it('should append chat completions endpoint when baseUrl ends with /v1', async () => {
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
      baseUrl: 'https://api.groq.com/openai/v1',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act
    await adapter.generateJson({
      systemPrompt: 'system',
      userPrompt: 'user',
      maxTokens: 120,
      timeoutMs: 5000,
    });

    // Assert
    expect(fetchFn.mock.calls[0]?.[0]).toBe('https://api.groq.com/openai/v1/chat/completions');
  });

  it('should append chat completions endpoint for custom base url paths', async () => {
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
      baseUrl: 'https://api.groq.com/openai/custom',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act
    await adapter.generateJson({
      systemPrompt: 'system',
      userPrompt: 'user',
      maxTokens: 120,
      timeoutMs: 5000,
    });

    // Assert
    expect(fetchFn.mock.calls[0]?.[0]).toBe('https://api.groq.com/openai/custom/chat/completions');
  });

  it('should throw error without provider suffix when non-ok response payload is not an object', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => 'internal',
    });

    const adapter = createGroqLlmAdapter({
      apiKey: 'groq-key',
      model: 'llama-3.3-70b-versatile',
      baseUrl: 'https://api.groq.com/openai',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act + Assert
    await expect(
      adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 120,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow(
      'Groq request failed with status 500 for model llama-3.3-70b-versatile at https://api.groq.com/openai/v1/chat/completions',
    );
  });

  it('should throw error without provider suffix when object payload has no message fields', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: {} }),
    });

    const adapter = createGroqLlmAdapter({
      apiKey: 'groq-key',
      model: 'llama-3.3-70b-versatile',
      baseUrl: 'https://api.groq.com/openai',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act + Assert
    await expect(
      adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 120,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow(
      'Groq request failed with status 500 for model llama-3.3-70b-versatile at https://api.groq.com/openai/v1/chat/completions',
    );
  });

  it('should use top-level provider message when error.message is not present', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ message: 'gateway exploded' }),
    });

    const adapter = createGroqLlmAdapter({
      apiKey: 'groq-key',
      model: 'llama-3.3-70b-versatile',
      baseUrl: 'https://api.groq.com/openai',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act + Assert
    await expect(
      adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 120,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow('Groq request failed with status 502 for model llama-3.3-70b-versatile');
    await expect(
      adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 120,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow('gateway exploded');
  });

  it('should handle non-json error payloads from provider', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => {
        throw new Error('invalid json');
      },
    });

    const adapter = createGroqLlmAdapter({
      apiKey: 'groq-key',
      model: 'llama-3.3-70b-versatile',
      baseUrl: 'https://api.groq.com/openai',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act + Assert
    await expect(
      adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 120,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow(
      'Groq request failed with status 503 for model llama-3.3-70b-versatile at https://api.groq.com/openai/v1/chat/completions',
    );
  });

  it('should not retry when status is 400 but provider message is missing', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({}),
    });

    const adapter = createGroqLlmAdapter({
      apiKey: 'groq-key',
      model: 'llama-3.3-70b-versatile',
      baseUrl: 'https://api.groq.com/openai',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act + Assert
    await expect(
      adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 120,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow(
      'Groq request failed with status 400 for model llama-3.3-70b-versatile at https://api.groq.com/openai/v1/chat/completions',
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('should throw when successful response has empty content', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: null } }],
      }),
    });

    const adapter = createGroqLlmAdapter({
      apiKey: 'groq-key',
      model: 'openai/gpt-oss-20b',
      baseUrl: 'https://api.groq.com/openai',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act + Assert
    await expect(
      adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 120,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow(
      'Groq response did not include text content for model openai/gpt-oss-20b at https://api.groq.com/openai/v1/chat/completions',
    );
  });

  it('should treat whitespace-only content as empty and throw', async () => {
    // Arrange
    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '   ' } }],
      }),
    });

    const adapter = createGroqLlmAdapter({
      apiKey: 'groq-key',
      model: 'openai/gpt-oss-20b',
      baseUrl: 'https://api.groq.com/openai',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    // Act + Assert
    await expect(
      adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 120,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow(
      'Groq response did not include text content for model openai/gpt-oss-20b at https://api.groq.com/openai/v1/chat/completions',
    );
  });

  it('should send undefined signal when AbortSignal.timeout is unavailable', async () => {
    // Arrange
    const timeoutDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, 'timeout');
    Object.defineProperty(AbortSignal, 'timeout', {
      configurable: true,
      value: undefined,
    });

    const fetchFn = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"ok":true}' } }],
      }),
    });

    const adapter = createGroqLlmAdapter({
      apiKey: 'groq-key',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    try {
      // Act
      await adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 120,
        timeoutMs: 5000,
      });
    } finally {
      if (timeoutDescriptor) {
        Object.defineProperty(AbortSignal, 'timeout', timeoutDescriptor);
      }
    }

    // Assert
    expect(fetchFn.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ signal: undefined }));
  });

  it('should use global fetch when fetchFn is not provided', async () => {
    // Arrange
    const originalFetch = global.fetch;
    const globalFetchMock = jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"ok":true}' } }],
      }),
    });
    global.fetch = globalFetchMock as unknown as typeof fetch;

    try {
      const adapter = createGroqLlmAdapter({
        apiKey: 'groq-key',
        model: 'llama-3.3-70b-versatile',
        baseUrl: 'https://api.groq.com/openai',
      });

      // Act
      await adapter.generateJson({
        systemPrompt: 'system',
        userPrompt: 'user',
        maxTokens: 120,
        timeoutMs: 5000,
      });
    } finally {
      global.fetch = originalFetch;
    }

    // Assert
    expect(globalFetchMock).toHaveBeenCalledTimes(1);
  });
});
