import fs from 'fs';
import os from 'os';
import path from 'path';

import { createIssueTriagePromptRegistry } from '../../../../src/shared/infrastructure/prompts/issue-triage-prompt-registry.adapter';

const FIXTURES_PATH = path.join(__dirname, '../../../fixtures/prompts/issue-triage');

describe('IssueTriagePromptRegistry (Paths)', () => {
  it('should resolve base path from config when provided', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v1.0.0.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: "1.0.0"',
        'provider: "generic"',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
      ].join('\n'),
    );
    const registry = createIssueTriagePromptRegistry({
      config: {
        get: (key: string) => (key === 'PROMPT_REGISTRY_PATH' ? tempDir : undefined),
        getBoolean: () => undefined,
      },
    });

    // Act
    const prompt = registry.getPrompt();

    // Assert
    expect(prompt.version).toBe('1.0.0');
  });

  it('should resolve default registry using repo prompt assets when no params are provided', () => {
    // Arrange
    const registry = createIssueTriagePromptRegistry();

    // Act
    const prompt = registry.getPrompt({ provider: 'generic' });

    // Assert
    expect(prompt.systemPrompt.length).toBeGreaterThan(0);
  });

  it('should throw when prompt registry path does not exist', () => {
    // Arrange
    const missingPath = path.join(os.tmpdir(), 'missing-prompt-registry');

    // Act + Assert
    expect(() => createIssueTriagePromptRegistry({ basePath: missingPath })).toThrow(
      'Prompt registry path does not exist',
    );
  });

  it('should throw when prompt entry is missing required fields', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v1.0.0.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: "1.0.0"',
        'provider: "generic"',
        'system_prompt: |',
        '  System prompt generic',
      ].join('\n'),
    );

    // Act + Assert
    expect(() => createIssueTriagePromptRegistry({ basePath: tempDir })).toThrow(
      'Invalid prompt registry entry',
    );
  });

  it('should reject non-string version values', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const promptPath = path.join(tempDir, 'issue-triage.v1.0.0.generic.yaml');
    fs.writeFileSync(
      promptPath,
      [
        'version: 1',
        'provider: "generic"',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
      ].join('\n'),
    );

    // Act + Assert
    expect(() => createIssueTriagePromptRegistry({ basePath: tempDir })).toThrow(
      'Invalid prompt registry entry',
    );
  });

  it('should use dist path when src path is missing', () => {
    // Arrange
    const originalCwd = process.cwd();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const distPath = path.join(tempDir, 'dist/shared/application/prompts/issue-triage');
    fs.mkdirSync(distPath, { recursive: true });
    fs.writeFileSync(
      path.join(distPath, 'issue-triage.v1.0.0.generic.yaml'),
      [
        'version: "1.0.0"',
        'provider: "generic"',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
      ].join('\n'),
    );

    process.chdir(tempDir);

    try {
      // Act
      const registry = createIssueTriagePromptRegistry({
        config: {
          get: () => undefined,
          getBoolean: () => undefined,
        },
      });
      const prompt = registry.getPrompt();

      // Assert
      expect(prompt.version).toBe('1.0.0');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should ignore non-matching filenames in registry', () => {
    // Arrange
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    fs.writeFileSync(path.join(tempDir, 'README.txt'), 'not a prompt');
    fs.writeFileSync(
      path.join(tempDir, 'issue-triage.v1.0.0.generic.yaml'),
      [
        'version: "1.0.0"',
        'provider: "generic"',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
      ].join('\n'),
    );

    // Act
    const registry = createIssueTriagePromptRegistry({ basePath: tempDir });
    const prompt = registry.getPrompt();

    // Assert
    expect(prompt.version).toBe('1.0.0');
  });

  it('should use src path when available', () => {
    // Arrange
    const originalCwd = process.cwd();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    const srcPath = path.join(tempDir, 'src/shared/application/prompts/issue-triage');
    fs.mkdirSync(srcPath, { recursive: true });
    fs.writeFileSync(
      path.join(srcPath, 'issue-triage.v1.0.0.generic.yaml'),
      [
        'version: "1.0.0"',
        'provider: "generic"',
        'system_prompt: |',
        '  System prompt generic',
        'user_prompt_template: |',
        '  Title: {{issue_title}}',
      ].join('\n'),
    );
    process.chdir(tempDir);

    try {
      // Act
      const registry = createIssueTriagePromptRegistry({
        config: {
          get: () => undefined,
          getBoolean: () => undefined,
        },
      });
      const prompt = registry.getPrompt();

      // Assert
      expect(prompt.version).toBe('1.0.0');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should default to src path when neither src nor dist exist', () => {
    // Arrange
    const originalCwd = process.cwd();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-registry-'));
    process.chdir(tempDir);

    try {
      // Act + Assert
      expect(() =>
        createIssueTriagePromptRegistry({
          config: {
            get: () => undefined,
            getBoolean: () => undefined,
          },
        }),
      ).toThrow('Prompt registry path does not exist');
    } finally {
      process.chdir(originalCwd);
    }
  });
});
