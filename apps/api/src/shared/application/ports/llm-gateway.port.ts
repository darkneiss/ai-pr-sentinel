export interface LLMGateway {
  generateJson(input: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens: number;
    timeoutMs: number;
    temperature?: number;
  }): Promise<{ rawText: string }>;
}
