import type { LLMGateway } from '../../../../src/shared/application/ports/llm-gateway.port';
import { createLlmGateway } from '../../../../src/shared/infrastructure/ai/llm-gateway.factory';

const createGateway = (name: string): LLMGateway => ({
  generateJson: jest.fn().mockResolvedValue({ rawText: `{\"provider\":\"${name}\"}` }),
});

describe('LlmGatewayFactory', () => {
  it('should create OpenAI gateway when provider is openai', () => {
    // Arrange
    const openAiGateway = createGateway('openai');

    // Act
    const gateway = createLlmGateway({
      provider: 'openai',
      createOpenAiLlmAdapter: () => openAiGateway,
      createGeminiLlmAdapter: () => createGateway('gemini'),
      createOllamaLlmAdapter: () => createGateway('ollama'),
    });

    // Assert
    expect(gateway).toBe(openAiGateway);
  });

  it('should create Gemini gateway when provider is gemini', () => {
    // Arrange
    const geminiGateway = createGateway('gemini');

    // Act
    const gateway = createLlmGateway({
      provider: 'gemini',
      createOpenAiLlmAdapter: () => createGateway('openai'),
      createGeminiLlmAdapter: () => geminiGateway,
      createOllamaLlmAdapter: () => createGateway('ollama'),
    });

    // Assert
    expect(gateway).toBe(geminiGateway);
  });

  it('should create Ollama gateway when provider is ollama', () => {
    // Arrange
    const ollamaGateway = createGateway('ollama');

    // Act
    const gateway = createLlmGateway({
      provider: 'ollama',
      createOpenAiLlmAdapter: () => createGateway('openai'),
      createGeminiLlmAdapter: () => createGateway('gemini'),
      createOllamaLlmAdapter: () => ollamaGateway,
    });

    // Assert
    expect(gateway).toBe(ollamaGateway);
  });

  it('should throw when provider is unsupported', () => {
    // Act + Assert
    expect(() =>
      createLlmGateway({
        provider: 'unknown-provider',
      }),
    ).toThrow('Unsupported LLM provider');
  });

  it('should read provider from environment variable when provider param is omitted', () => {
    // Arrange
    const previousProvider = process.env.LLM_PROVIDER;
    process.env.LLM_PROVIDER = 'gemini';
    const geminiGateway = createGateway('gemini-env');

    try {
      // Act
      const gateway = createLlmGateway({
        createGeminiLlmAdapter: () => geminiGateway,
        createOpenAiLlmAdapter: () => createGateway('openai'),
        createOllamaLlmAdapter: () => createGateway('ollama'),
      });

      // Assert
      expect(gateway).toBe(geminiGateway);
    } finally {
      process.env.LLM_PROVIDER = previousProvider;
    }
  });

  it('should default to ollama when provider param and env are missing', () => {
    // Arrange
    const previousProvider = process.env.LLM_PROVIDER;
    delete process.env.LLM_PROVIDER;
    const ollamaGateway = createGateway('ollama-default');

    try {
      // Act
      const gateway = createLlmGateway({
        createOpenAiLlmAdapter: () => createGateway('openai'),
        createGeminiLlmAdapter: () => createGateway('gemini'),
        createOllamaLlmAdapter: () => ollamaGateway,
      });

      // Assert
      expect(gateway).toBe(ollamaGateway);
    } finally {
      process.env.LLM_PROVIDER = previousProvider;
    }
  });

  it('should build gateway using default params object and env provider', () => {
    // Arrange
    const previousProvider = process.env.LLM_PROVIDER;
    process.env.LLM_PROVIDER = 'ollama';

    try {
      // Act
      const gateway = createLlmGateway();

      // Assert
      expect(gateway).toBeDefined();
    } finally {
      process.env.LLM_PROVIDER = previousProvider;
    }
  });
});
