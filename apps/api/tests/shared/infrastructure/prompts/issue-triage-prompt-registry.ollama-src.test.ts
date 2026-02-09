import path from 'path';

import { createIssueTriagePromptRegistry } from '../../../../src/shared/infrastructure/prompts/issue-triage-prompt-registry.adapter';

describe('IssueTriagePromptRegistry (Ollama src prompt)', () => {
  it('should load the Ollama-specific prompt from src registry', () => {
    // Arrange
    const basePath = path.join(process.cwd(), 'src/shared/application/prompts/issue-triage');
    const registry = createIssueTriagePromptRegistry({ basePath });

    // Act
    const prompt = registry.getPrompt({ provider: 'ollama', version: '1.1.0' });

    // Assert
    expect(prompt.provider).toBe('ollama');
    expect(prompt.version).toBe('1.1.0');
    expect(prompt.systemPrompt).toContain('Ollama');
    expect(prompt.userPromptTemplate).toContain('{{issue_title}}');
  });
});
