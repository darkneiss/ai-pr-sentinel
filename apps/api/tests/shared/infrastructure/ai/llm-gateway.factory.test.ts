import type { LLMGateway } from '../../../../src/shared/application/ports/llm-gateway.port';
import { createLlmGateway } from '../../../../src/infrastructure/composition/llm-gateway.factory';

const createGateway = (name: string): LLMGateway => ({
  generateJson: jest.fn().mockResolvedValue({ rawText: `{\"provider\":\"${name}\"}` }),
});

describe('LlmGatewayFactory', () => {
  it('should throw when provider is openai', () => {
    // Act + Assert
    expect(() =>
      createLlmGateway({
        provider: 'openai',
      }),
    ).toThrow('Unsupported LLM provider');
  });

  it('should create Gemini gateway when provider is gemini', () => {
    // Arrange
    const geminiGateway = createGateway('gemini');

    // Act
    const gateway = createLlmGateway({
      provider: 'gemini',
      createGeminiLlmAdapter: () => geminiGateway,
      createOllamaLlmAdapter: () => createGateway('ollama'),
      createGroqLlmAdapter: () => createGateway('groq'),
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
      createGeminiLlmAdapter: () => createGateway('gemini'),
      createOllamaLlmAdapter: () => ollamaGateway,
      createGroqLlmAdapter: () => createGateway('groq'),
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

  it('should read provider from config when provider param is omitted', () => {
    // Arrange
    const geminiGateway = createGateway('gemini-env');
    const config = {
      get: jest.fn().mockReturnValue('gemini'),
      getBoolean: jest.fn(),
    };

    // Act
    const gateway = createLlmGateway({
      config,
      createGeminiLlmAdapter: () => geminiGateway,
      createOllamaLlmAdapter: () => createGateway('ollama'),
      createGroqLlmAdapter: () => createGateway('groq'),
    });

    // Assert
    expect(gateway).toBe(geminiGateway);
  });

  it('should default to ollama when provider param and env are missing', () => {
    // Arrange
    const previousProvider = process.env.LLM_PROVIDER;
    delete process.env.LLM_PROVIDER;
    const ollamaGateway = createGateway('ollama-default');

    try {
      // Act
      const gateway = createLlmGateway({
        createGeminiLlmAdapter: () => createGateway('gemini'),
        createOllamaLlmAdapter: () => ollamaGateway,
        createGroqLlmAdapter: () => createGateway('groq'),
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
