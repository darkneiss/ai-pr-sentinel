import type { LLMGateway } from '../../../../src/shared/application/ports/llm-gateway.port';
import { createLlmGateway } from '../../../../src/infrastructure/composition/llm-gateway.factory';

const createGateway = (name: string): LLMGateway => ({
  generateJson: jest.fn().mockResolvedValue({ rawText: `{"provider":"${name}"}` }),
});

describe('LlmGatewayFactory (Groq)', () => {
  it('should create Groq gateway when provider is groq', () => {
    // Arrange
    const groqGateway = createGateway('groq');

    // Act
    const gateway = createLlmGateway({
      provider: 'groq',
      createGeminiLlmAdapter: () => createGateway('gemini'),
      createOllamaLlmAdapter: () => createGateway('ollama'),
      createGroqLlmAdapter: () => groqGateway,
    });

    // Assert
    expect(gateway).toBe(groqGateway);
  });
});
