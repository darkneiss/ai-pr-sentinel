import type { Issue } from '../../../../src/features/triage/domain/entities/issue.entity';
import { validateIssueIntegrity } from '../../../../src/features/triage/application/use-cases/validate-issue-integrity.use-case';

// Helper factory to quickly create issues in tests
const createIssue = (overrides: Partial<Issue> = {}): Issue => ({
  id: 'ISSUE-123',
  title: 'Bug: Application crashes on startup', // Valid title (>10 chars)
  description: 'The application fails to load when the .env file is missing variables.', // Valid description (>30 chars)
  author: 'senior_dev',
  createdAt: new Date(),
  ...overrides,
});

describe('ValidateIssueIntegrity Use Case', () => {
  // Happy path
  it('should accept a fully valid issue', () => {
    const validIssue = createIssue();
    const result = validateIssueIntegrity(validIssue);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // Title validation cases
  describe('Rule: Title Validation', () => {
    it('should reject when title is empty', () => {
      const result = validateIssueIntegrity(createIssue({ title: '' }));
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Title is required');
    });

    it('should reject when title is only whitespace', () => {
      const result = validateIssueIntegrity(createIssue({ title: '    ' }));

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Title is required');
    });

    it('should reject when title is too short (< 10 chars)', () => {
      const result = validateIssueIntegrity(createIssue({ title: 'Bug fix' }));
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Title is too short (min 10 chars)');
    });
  });

  // Description validation cases
  describe('Rule: Description Validation', () => {
    it('should reject when description is empty', () => {
      const result = validateIssueIntegrity(createIssue({ description: '' }));
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Description is required');
    });

    it('should reject when description is only whitespace', () => {
      const result = validateIssueIntegrity(createIssue({ description: '                              ' }));

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Description is required');
    });

    it('should reject when description is too short (< 30 chars)', () => {
      const result = validateIssueIntegrity(createIssue({ description: 'It crashes.' }));
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Description is too short (min 30 chars) to be useful');
    });
  });

  // Author validation cases
  describe('Rule: Author Validation', () => {
    it('should reject when author is missing', () => {
      const result = validateIssueIntegrity(createIssue({ author: '' }));
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Author is required');
    });

    it('should reject when author is only whitespace', () => {
      const result = validateIssueIntegrity(createIssue({ author: '   ' }));

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Author is required');
    });
  });
});
