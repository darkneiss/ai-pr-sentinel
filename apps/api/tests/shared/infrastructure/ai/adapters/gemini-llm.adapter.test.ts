import { createGeminiLlmAdapter } from '../../../../../src/shared/infrastructure/ai/adapters/gemini-llm.adapter';
import type { ConfigPort } from '../../../../../src/shared/application/ports/config.port';

interface MockFetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

type GenerateJsonInput = Parameters<ReturnType<typeof createGeminiLlmAdapter>['generateJson']>[0];

const DEFAULT_JSON_TEXT = '{"classification":{}}';

const DEFAULT_GENERATE_JSON_INPUT: GenerateJsonInput = {
  systemPrompt: 'system',
  userPrompt: 'user',
  maxTokens: 120,
  timeoutMs: 5000,
  temperature: 0.2,
};

const createFetchFnMock = (response: MockFetchResponse): jest.MockedFunction<typeof fetch> =>
  jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue(response) as unknown as
    jest.MockedFunction<typeof fetch>;

const createAdapterWithFetch = (fetchFn: typeof fetch) =>
  createGeminiLlmAdapter({
    apiKey: 'gemini-key',
    model: 'gemini-1.5-flash',
    fetchFn,
  });

const runGenerateJson = (
  adapter: ReturnType<typeof createGeminiLlmAdapter>,
  overrides: Partial<typeof DEFAULT_GENERATE_JSON_INPUT> = {},
) =>
  adapter.generateJson({
    ...DEFAULT_GENERATE_JSON_INPUT,
    ...overrides,
  });

describe('GeminiLlmAdapter', () => {
  it('should call Gemini generateContent and return raw text', async () => {
    // Arrange
    const fetchFn = createFetchFnMock({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: DEFAULT_JSON_TEXT }],
            },
          },
        ],
      }),
    });
    const adapter = createAdapterWithFetch(fetchFn);

    // Act
    const result = await runGenerateJson(adapter);

    // Assert
    expect(result).toEqual({ rawText: DEFAULT_JSON_TEXT });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('should request JSON-only output via responseMimeType', async () => {
    // Arrange
    const fetchFn = createFetchFnMock({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: DEFAULT_JSON_TEXT }],
            },
          },
        ],
      }),
    });
    const adapter = createAdapterWithFetch(fetchFn);

    // Act
    await runGenerateJson(adapter);

    // Assert
    const requestInit = fetchFn.mock.calls[0]?.[1];
    const requestBody = JSON.parse((requestInit?.body as string) ?? '{}') as {
      generationConfig?: { responseMimeType?: string };
    };
    expect(requestBody.generationConfig?.responseMimeType).toBe('application/json');
  });

  it('should throw when Gemini returns non-ok response', async () => {
    // Arrange
    const fetchFn = createFetchFnMock({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'quota exceeded' } }),
    });
    const adapter = createAdapterWithFetch(fetchFn);

    // Act + Assert
    await expect(runGenerateJson(adapter)).rejects.toThrow('Gemini request failed');
  });

  it('should include model and provider error message when Gemini returns non-ok response', async () => {
    // Arrange
    const fetchFn = createFetchFnMock({
      ok: false,
      status: 404,
      json: async () => ({ error: { message: 'models/gemini-1.5-flash is not found' } }),
    });
    const adapter = createAdapterWithFetch(fetchFn);

    // Act + Assert
    await expect(runGenerateJson(adapter)).rejects.toThrow(
      'Gemini request failed with status 404 for model gemini-1.5-flash',
    );
  });

  it('should include status and model when non-ok response has no provider error message', async () => {
    // Arrange
    const fetchFn = createFetchFnMock({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('invalid json');
      },
    });
    const adapter = createAdapterWithFetch(fetchFn);

    // Act + Assert
    await expect(runGenerateJson(adapter)).rejects.toThrow(
      'Gemini request failed with status 502 for model gemini-1.5-flash',
    );
  });

  it('should throw when Gemini response does not include candidate text', async () => {
    // Arrange
    const fetchFn = createFetchFnMock({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [] } }],
      }),
    });
    const adapter = createAdapterWithFetch(fetchFn);

    // Act + Assert
    await expect(runGenerateJson(adapter)).rejects.toThrow('Gemini response did not include text content');
  });

  it('should throw when API key is missing', () => {
    // Arrange
    const previousValue = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      // Act + Assert
      expect(() => createGeminiLlmAdapter()).toThrow(
        'Missing Gemini API key. Provide "apiKey" or set GEMINI_API_KEY',
      );
    } finally {
      process.env.GEMINI_API_KEY = previousValue;
    }
  });

  it('should call fetch without signal when AbortSignal.timeout is unavailable', async () => {
    // Arrange
    const fetchFn = createFetchFnMock({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: DEFAULT_JSON_TEXT }],
            },
          },
        ],
      }),
    });
    const originalAbortSignalTimeout = AbortSignal.timeout;
    (AbortSignal as unknown as { timeout?: unknown }).timeout = undefined;
    const adapter = createAdapterWithFetch(fetchFn);

    try {
      // Act
      await runGenerateJson(adapter);
    } finally {
      (AbortSignal as unknown as { timeout?: typeof AbortSignal.timeout }).timeout =
        originalAbortSignalTimeout;
    }

    // Assert
    expect(fetchFn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        signal: undefined,
      }),
    );
  });

  it('should create adapter with default model and baseUrl from environment key', () => {
    // Arrange
    const previousValue = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'env-gemini-key';

    try {
      // Act
      const adapter = createGeminiLlmAdapter();

      // Assert
      expect(adapter).toBeDefined();
    } finally {
      process.env.GEMINI_API_KEY = previousValue;
    }
  });

  it('should prioritize generic LLM_* environment variables over Gemini-specific ones', async () => {
    // Arrange
    const previousLlmApiKey = process.env.LLM_API_KEY;
    const previousLlmModel = process.env.LLM_MODEL;
    const previousLlmBaseUrl = process.env.LLM_BASE_URL;
    const previousGeminiApiKey = process.env.GEMINI_API_KEY;
    const previousGeminiModel = process.env.GEMINI_MODEL;
    const previousGeminiBaseUrl = process.env.GEMINI_BASE_URL;
    process.env.LLM_API_KEY = 'generic-key';
    process.env.LLM_MODEL = 'generic-model';
    process.env.LLM_BASE_URL = 'https://generic-gemini-base.test';
    process.env.GEMINI_API_KEY = 'provider-key';
    process.env.GEMINI_MODEL = 'provider-model';
    process.env.GEMINI_BASE_URL = 'https://provider-gemini-base.test';
    const fetchFn = createFetchFnMock({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: DEFAULT_JSON_TEXT }],
            },
          },
        ],
      }),
    });
    const adapter = createGeminiLlmAdapter({ fetchFn });

    try {
      // Act
      await runGenerateJson(adapter, { maxTokens: 25 });
    } finally {
      process.env.LLM_API_KEY = previousLlmApiKey;
      process.env.LLM_MODEL = previousLlmModel;
      process.env.LLM_BASE_URL = previousLlmBaseUrl;
      process.env.GEMINI_API_KEY = previousGeminiApiKey;
      process.env.GEMINI_MODEL = previousGeminiModel;
      process.env.GEMINI_BASE_URL = previousGeminiBaseUrl;
    }

    // Assert
    expect(fetchFn).toHaveBeenCalledWith(
      'https://generic-gemini-base.test/models/generic-model:generateContent?key=generic-key',
      expect.any(Object),
    );
  });

  it('should prioritize config values over environment variables', async () => {
    // Arrange
    const previousLlmApiKey = process.env.LLM_API_KEY;
    const previousLlmModel = process.env.LLM_MODEL;
    const previousLlmBaseUrl = process.env.LLM_BASE_URL;
    process.env.LLM_API_KEY = 'env-key';
    process.env.LLM_MODEL = 'env-model';
    process.env.LLM_BASE_URL = 'https://env-gemini-base.test';
    const config: ConfigPort = {
      get: (key: string): string | undefined => {
        if (key === 'LLM_API_KEY') {
          return 'config-key';
        }

        if (key === 'LLM_MODEL') {
          return 'config-model';
        }

        if (key === 'LLM_BASE_URL') {
          return 'https://config-gemini-base.test';
        }

        return undefined;
      },
      getBoolean: (_key: string): boolean | undefined => undefined,
    };
    const fetchFn = createFetchFnMock({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: DEFAULT_JSON_TEXT }],
            },
          },
        ],
      }),
    });
    const adapter = createGeminiLlmAdapter({ config, fetchFn });

    try {
      // Act
      await runGenerateJson(adapter);
    } finally {
      process.env.LLM_API_KEY = previousLlmApiKey;
      process.env.LLM_MODEL = previousLlmModel;
      process.env.LLM_BASE_URL = previousLlmBaseUrl;
    }

    // Assert
    expect(fetchFn).toHaveBeenCalledWith(
      'https://config-gemini-base.test/models/config-model:generateContent?key=config-key',
      expect.any(Object),
    );
  });
});
