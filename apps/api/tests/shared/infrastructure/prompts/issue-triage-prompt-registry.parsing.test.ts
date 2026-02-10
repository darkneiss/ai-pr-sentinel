import fs from 'fs';
import os from 'os';
import path from 'path';

import { createIssueTriagePromptRegistry } from '../../../../src/shared/infrastructure/prompts/issue-triage-prompt-registry.adapter';

describe('IssueTriagePromptRegistry (Parsing)', () => {
  it('should map max_tokens config into maxTokens', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v1.2.0.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: "1.2.0"',
        'provider: "generic"',
        'config:',
        '  max_tokens: 512',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
      ].join('\n'),
    );
    const registry = createIssueTriagePromptRegistry({ basePath: tempDir });

    // Act
    const prompt = registry.getPrompt();

    // Assert
    expect(prompt.config?.maxTokens).toBe(512);
  });

  it('should map maxTokens when provided in camelCase config', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v1.3.0.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: "1.3.0"',
        'provider: "generic"',
        'config:',
        '  maxTokens: 640',
        '  label: "quoted"',
        '  invalid_config_line',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
      ].join('\n'),
    );
    const registry = createIssueTriagePromptRegistry({ basePath: tempDir });

    // Act
    const prompt = registry.getPrompt();

    // Assert
    expect(prompt.config?.maxTokens).toBe(640);
  });

  it('should parse quoted scalar values in top-level fields', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v2.0.0.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: "2.0.0"',
        'provider: "generic"',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
        'output_contract: "Quoted contract"',
      ].join('\n'),
    );
    const registry = createIssueTriagePromptRegistry({ basePath: tempDir });

    // Act
    const prompt = registry.getPrompt();

    // Assert
    expect(prompt.outputContract).toBe('Quoted contract');
  });

  it('should parse single-quoted scalar values', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v2.1.0.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        "version: '2.1.0'",
        "provider: 'generic'",
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
        "output_contract: 'Single quoted'",
      ].join('\n'),
    );
    const registry = createIssueTriagePromptRegistry({ basePath: tempDir });

    // Act
    const prompt = registry.getPrompt();

    // Assert
    expect(prompt.outputContract).toBe('Single quoted');
  });

  it('should parse config blocks with numeric values', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v3.0.0.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: "3.0.0"',
        'provider: "generic"',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
        'config:',
        '  temperature: 0.25',
        '  max_tokens: 512',
      ].join('\n'),
    );
    const registry = createIssueTriagePromptRegistry({ basePath: tempDir });

    // Act
    const prompt = registry.getPrompt();

    // Assert
    expect(prompt.config?.temperature).toBe(0.25);
    expect(prompt.config?.maxTokens).toBe(512);
  });

  it('should ignore non-matching config lines while keeping valid entries', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v3.0.1.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: "3.0.1"',
        'provider: "generic"',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
        'config:',
        '  not a config line',
        '  temperature: 0.4',
      ].join('\n'),
    );
    const registry = createIssueTriagePromptRegistry({ basePath: tempDir });

    // Act
    const prompt = registry.getPrompt();

    // Assert
    expect(prompt.config?.temperature).toBe(0.4);
  });

  it('should throw when provider is not a string', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v3.1.0.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: "3.1.0"',
        'provider: 123',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
      ].join('\n'),
    );

    // Act + Assert
    expect(() => createIssueTriagePromptRegistry({ basePath: tempDir })).toThrow(
      'Invalid prompt registry entry: missing required fields',
    );
  });

  it('should throw when system prompt is not a string', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v3.2.0.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: "3.2.0"',
        'provider: "generic"',
        'system_prompt: 42',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
      ].join('\n'),
    );

    // Act + Assert
    expect(() => createIssueTriagePromptRegistry({ basePath: tempDir })).toThrow(
      'Invalid prompt registry entry: missing required fields',
    );
  });

  it('should parse empty scalar values as empty strings', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v3.3.0.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: "3.3.0"',
        'provider: "generic"',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
        'output_contract:',
      ].join('\n'),
    );
    const registry = createIssueTriagePromptRegistry({ basePath: tempDir });

    // Act
    const prompt = registry.getPrompt();

    // Assert
    expect(prompt.outputContract).toBe('');
  });

  it('should parse config keys with empty scalar values', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v3.3.1.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: "3.3.1"',
        'provider: "generic"',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
        'config:',
        '  max_tokens:',
        '  temperature:',
      ].join('\n'),
    );
    const registry = createIssueTriagePromptRegistry({ basePath: tempDir });

    // Act
    const prompt = registry.getPrompt();

    // Assert
    expect(prompt.config?.maxTokens).toBeUndefined();
    expect(prompt.config?.temperature).toBeUndefined();
  });

  it('should accept unknown top-level keys without failing', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v3.4.0.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: "3.4.0"',
        'provider: "generic"',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
        'misc: value',
      ].join('\n'),
    );
    const registry = createIssueTriagePromptRegistry({ basePath: tempDir });

    // Act
    const prompt = registry.getPrompt();

    // Assert
    expect(prompt.version).toBe('3.4.0');
  });

});
