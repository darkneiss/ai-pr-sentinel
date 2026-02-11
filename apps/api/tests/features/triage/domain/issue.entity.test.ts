import { IssueEntity } from '../../../../src/features/triage/domain/entities/issue.entity';

describe('IssueEntity', () => {
  it('should normalize title, description, and author', () => {
    // Arrange
    const rawIssue = {
      id: ' ISSUE-123 ',
      title: '  Bug: Login fails after token refresh  ',
      description: '  Repro steps: refresh token and retry protected endpoint.  ',
      author: '  dev_user  ',
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
    };

    // Act
    const issue = IssueEntity.create(rawIssue);

    // Assert
    expect(issue.getNormalizedTitle()).toBe('Bug: Login fails after token refresh');
    expect(issue.getNormalizedDescription()).toBe('Repro steps: refresh token and retry protected endpoint.');
    expect(issue.getNormalizedAuthor()).toBe('dev_user');
  });

  it('should build normalized issue content for domain policies', () => {
    // Arrange
    const issue = IssueEntity.create({
      id: 'ISSUE-123',
      title: '  Bug: Startup crash  ',
      description: '  App crashes when ENV var is missing.  ',
      author: '  dev_user  ',
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
    });

    // Act
    const normalizedIssueContent = issue.getNormalizedContent();

    // Assert
    expect(normalizedIssueContent).toBe('Bug: Startup crash\nApp crashes when ENV var is missing.');
  });

  it('should validate integrity and return domain errors', () => {
    // Arrange
    const issue = IssueEntity.create({
      id: 'ISSUE-123',
      title: 'short',
      description: 'tiny',
      author: '  ',
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
    });

    // Act
    const result = issue.validateIntegrity();

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Title is too short (min 10 chars)');
    expect(result.errors).toContain('Description is too short (min 30 chars) to be useful');
    expect(result.errors).toContain('Author is required');
  });
});
