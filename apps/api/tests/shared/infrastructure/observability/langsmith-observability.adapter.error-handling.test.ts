import { createLangSmithObservabilityAdapter } from '../../../../src/shared/infrastructure/observability/langsmith-observability.adapter';
import type { ConfigPort } from '../../../../src/shared/application/ports/config.port';

interface MockFetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

const createFetchFnMock = (response: MockFetchResponse): jest.MockedFunction<typeof fetch> =>
  jest.fn<Promise<MockFetchResponse>, [string, RequestInit?]>().mockResolvedValue(response) as unknown as
    jest.MockedFunction<typeof fetch>;

const DEFAULT_LANGSMITH_ENDPOINT = 'https://api.smith.langchain.com';
const DEFAULT_API_KEY = 'ls-key';
const DEFAULT_RUN_NAME = 'issue_triage_llm';
const DEFAULT_RUN_TYPE = 'llm';
const DEFAULT_PROVIDER = 'groq';
const DEFAULT_MODEL = 'openai/gpt-oss-20b';

const createConfig = (values: Record<string, string>): ConfigPort => ({
  get: (key: string): string | undefined => values[key],
  getBoolean: (_key: string): boolean | undefined => undefined,
});

describe('LangSmithObservabilityAdapter', () => {
  it('should include provider error message when create run fails', async () => {
    // Arrange
    const fetchFn = createFetchFnMock({
      ok: false,
      status: 500,
      json: async () => ({ message: 'boom' }),
    });
    const config = createConfig({
      LANGSMITH_API_KEY: DEFAULT_API_KEY,
      LANGSMITH_ENDPOINT: DEFAULT_LANGSMITH_ENDPOINT,
    });
    const adapter = createLangSmithObservabilityAdapter({
      config,
      fetchFn,
      idGenerator: () => 'run-6',
    });

    // Act + Assert
    await expect(
      adapter.trackRequest({
        runName: DEFAULT_RUN_NAME,
        runType: DEFAULT_RUN_TYPE,
        provider: DEFAULT_PROVIDER,
        model: DEFAULT_MODEL,
        inputs: { userPrompt: 'user' },
        startedAt: '2026-02-10T00:00:05.000Z',
      }),
    ).rejects.toThrow('LangSmith request failed with status 500: boom');
  });

  it('should include provider error message when update run fails', async () => {
    // Arrange
    const fetchFn = createFetchFnMock({
      ok: false,
      status: 409,
      json: async () => ({ message: 'conflict' }),
    });
    const config = createConfig({
      LANGSMITH_API_KEY: DEFAULT_API_KEY,
      LANGSMITH_ENDPOINT: DEFAULT_LANGSMITH_ENDPOINT,
    });
    const adapter = createLangSmithObservabilityAdapter({
      config,
      fetchFn,
    });

    // Act + Assert
    await expect(
      adapter.trackResponse({
        runId: 'run-7',
        outputs: { rawText: '{"ok":true}' },
        endedAt: '2026-02-10T00:00:05.500Z',
      }),
    ).rejects.toThrow('LangSmith request failed with status 409: conflict');
  });

  it('should omit provider message when error payload is invalid', async () => {
    // Arrange
    const fetchFn = createFetchFnMock({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('invalid json');
      },
    });
    const config = createConfig({
      LANGSMITH_API_KEY: DEFAULT_API_KEY,
      LANGSMITH_ENDPOINT: DEFAULT_LANGSMITH_ENDPOINT,
    });
    const adapter = createLangSmithObservabilityAdapter({
      config,
      fetchFn,
    });

    // Act + Assert
    await expect(
      adapter.trackResponse({
        runId: 'run-7',
        outputs: { rawText: '{"ok":true}' },
        endedAt: '2026-02-10T00:00:06.000Z',
      }),
    ).rejects.toThrow('LangSmith request failed with status 502');
  });

  it('should omit provider message when error payload is not an object', async () => {
    // Arrange
    const fetchFn = createFetchFnMock({
      ok: false,
      status: 400,
      json: async () => 'not-an-object',
    });
    const config = createConfig({
      LANGSMITH_API_KEY: DEFAULT_API_KEY,
      LANGSMITH_ENDPOINT: DEFAULT_LANGSMITH_ENDPOINT,
    });
    const adapter = createLangSmithObservabilityAdapter({
      config,
      fetchFn,
    });

    // Act + Assert
    await expect(
      adapter.trackRequest({
        runName: DEFAULT_RUN_NAME,
        runType: DEFAULT_RUN_TYPE,
        provider: DEFAULT_PROVIDER,
        model: DEFAULT_MODEL,
        inputs: { userPrompt: 'user' },
        startedAt: '2026-02-10T00:00:08.000Z',
      }),
    ).rejects.toThrow('LangSmith request failed with status 400');
  });

  it('should omit provider message when error payload message is not a string', async () => {
    // Arrange
    const fetchFn = createFetchFnMock({
      ok: false,
      status: 401,
      json: async () => ({ message: 42 }),
    });
    const config = createConfig({
      LANGSMITH_API_KEY: DEFAULT_API_KEY,
      LANGSMITH_ENDPOINT: DEFAULT_LANGSMITH_ENDPOINT,
    });
    const adapter = createLangSmithObservabilityAdapter({
      config,
      fetchFn,
    });

    // Act + Assert
    await expect(
      adapter.trackRequest({
        runName: DEFAULT_RUN_NAME,
        runType: DEFAULT_RUN_TYPE,
        provider: DEFAULT_PROVIDER,
        model: DEFAULT_MODEL,
        inputs: { userPrompt: 'user' },
        startedAt: '2026-02-10T00:00:08.500Z',
      }),
    ).rejects.toThrow('LangSmith request failed with status 401');
  });

  it('should throw when api key is missing', () => {
    // Arrange
    const config: ConfigPort = {
      get: (_key: string): string | undefined => undefined,
      getBoolean: (_key: string): boolean | undefined => undefined,
    };

    // Act + Assert
    expect(() => createLangSmithObservabilityAdapter({ config })).toThrow('Missing LangSmith API key');
  });
});
