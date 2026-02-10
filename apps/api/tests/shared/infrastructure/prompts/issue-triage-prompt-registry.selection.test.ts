import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  comparePromptVersions,
  createIssueTriagePromptRegistry,
} from '../../../../src/shared/infrastructure/prompts/issue-triage-prompt-registry.adapter';

const FIXTURES_PATH = path.join(__dirname, '../../../fixtures/prompts/issue-triage');

describe('IssueTriagePromptRegistry (Selection)', () => {
  it('should return provider-specific prompt when available', () => {
    // Arrange
    const registry = createIssueTriagePromptRegistry({ basePath: FIXTURES_PATH });

    // Act
    const prompt = registry.getPrompt({ provider: 'groq', version: '1.0.0' });

    // Assert
    expect(prompt.provider).toBe('groq');
    expect(prompt.version).toBe('1.0.0');
    expect(prompt.systemPrompt).toContain('System prompt groq');
  });

  it('should fallback to generic prompt when provider variant is missing', () => {
    // Arrange
    const registry = createIssueTriagePromptRegistry({ basePath: FIXTURES_PATH });

    // Act
    const prompt = registry.getPrompt({ provider: 'gemini', version: '1.0.0' });

    // Assert
    expect(prompt.provider).toBe('generic');
    expect(prompt.version).toBe('1.0.0');
  });

  it('should choose the highest available version when version is not provided', () => {
    // Arrange
    const registry = createIssueTriagePromptRegistry({ basePath: FIXTURES_PATH });

    // Act
    const prompt = registry.getPrompt({ provider: 'ollama' });

    // Assert
    expect(prompt.version).toBe('1.1.0');
  });

  it('should throw when no prompts exist for provider or generic', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    fs.writeFileSync(
      path.join(tempDir, 'issue-triage.v1.0.0.groq.yaml'),
      [
        'version: "1.0.0"',
        'provider: "groq"',
        'system_prompt: |',
        '  System prompt groq',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
      ].join('\n'),
    );
    const registry = createIssueTriagePromptRegistry({ basePath: tempDir });

    // Act + Assert
    expect(() => registry.getPrompt({ provider: 'ollama' })).toThrow('No prompts available');
  });

  it('should throw when version is not found for provider', () => {
    // Arrange
    const registry = createIssueTriagePromptRegistry({ basePath: FIXTURES_PATH });

    // Act + Assert
    expect(() => registry.getPrompt({ provider: 'groq', version: '9.9.9' })).toThrow(
      'Prompt version "9.9.9" not found',
    );
  });

  it('should prefer stable version over prerelease when core is equal', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    fs.writeFileSync(
      path.join(tempDir, 'issue-triage.v1.2.0-beta.ollama.yaml'),
      [
        'version: "1.2.0-beta"',
        'provider: "ollama"',
        'system_prompt: |',
        '  System prompt ollama beta',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
      ].join('\n'),
    );
    fs.writeFileSync(
      path.join(tempDir, 'issue-triage.v1.2.0.ollama.yaml'),
      [
        'version: "1.2.0"',
        'provider: "ollama"',
        'system_prompt: |',
        '  System prompt ollama stable',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
      ].join('\n'),
    );
    const registry = createIssueTriagePromptRegistry({ basePath: tempDir });

    // Act
    const prompt = registry.getPrompt({ provider: 'ollama' });

    // Assert
    expect(prompt.version).toBe('1.2.0');
  });

  it('should compare prompt versions consistently', () => {
    // Arrange + Act + Assert
    expect(comparePromptVersions('2.0.0', '1.0.0')).toBeGreaterThan(0);
    expect(comparePromptVersions('1.0.0', '1.0.0')).toBe(0);
    expect(comparePromptVersions('1.0.0', '1.0.0-beta')).toBeGreaterThan(0);
    expect(comparePromptVersions('1.0.0-beta', '1.0.0')).toBeLessThan(0);
    expect(comparePromptVersions('1.0.0-alpha', '1.0.0-beta')).toBeLessThan(0);
  });

  it('should compare versions with different segment lengths', () => {
    // Arrange + Act + Assert
    expect(comparePromptVersions('1', '1.0.1')).toBeLessThan(0);
    expect(comparePromptVersions('1.2.3', '1')).toBeGreaterThan(0);
  });

  it('should create registry without explicit config', () => {
    // Arrange
    const previousProvider = process.env.LLM_PROVIDER;
    process.env.LLM_PROVIDER = 'generic';

    try {
      // Act
      const registry = createIssueTriagePromptRegistry({ basePath: FIXTURES_PATH });
      const prompt = registry.getPrompt();

      // Assert
      expect(prompt.provider).toBe('generic');
    } finally {
      process.env.LLM_PROVIDER = previousProvider;
    }
  });
});
