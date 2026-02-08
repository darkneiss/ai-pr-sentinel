import type { Issue } from '../../../../src/features/triage/domain/entities/issue.entity';
import { validateIssueIntegrity } from '../../../../src/features/triage/domain/services/issue-validation.service';

const createIssue = (overrides: Partial<Issue> = {}): Issue => ({
  id: 'ISSUE-123',
  title: 'Bug: Application crashes on startup',
  description: 'The application fails to load when the .env file is missing variables.',
  author: 'senior_dev',
  createdAt: new Date(),
  ...overrides,
});

describe('IssueValidationService', () => {
  it('should accept a fully valid issue', () => {
    // Arrange
    const validIssue = createIssue();

    // Act
    const result = validateIssueIntegrity(validIssue);

    // Assert
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject when title is empty', () => {
    // Arrange
    const issue = createIssue({ title: '' });

    // Act
    const result = validateIssueIntegrity(issue);

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Title is required');
  });

  it('should reject when title is too short', () => {
    // Arrange
    const issue = createIssue({ title: 'Bug fix' });

    // Act
    const result = validateIssueIntegrity(issue);

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Title is too short (min 10 chars)');
  });

  it('should reject when description is empty', () => {
    // Arrange
    const issue = createIssue({ description: '' });

    // Act
    const result = validateIssueIntegrity(issue);

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Description is required');
  });

  it('should reject when description is too short', () => {
    // Arrange
    const issue = createIssue({ description: 'It crashes.' });

    // Act
    const result = validateIssueIntegrity(issue);

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Description is too short (min 30 chars) to be useful');
  });

  it('should reject when author is missing', () => {
    // Arrange
    const issue = createIssue({ author: '   ' });

    // Act
    const result = validateIssueIntegrity(issue);

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Author is required');
  });
});
