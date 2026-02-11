import { IssueAuthor } from '../../../../src/features/triage/domain/value-objects/issue-author.value-object';

describe('IssueAuthorValueObject', () => {
  it('should expose raw and normalized values', () => {
    // Arrange
    const rawValue = '  dev_user  ';

    // Act
    const issueAuthor = IssueAuthor.create(rawValue);

    // Assert
    expect(issueAuthor.value).toBe(rawValue);
    expect(issueAuthor.normalizedValue).toBe('dev_user');
  });

  it('should report whether author has text', () => {
    // Arrange
    const issueAuthor = IssueAuthor.create('   ');

    // Act
    const hasText = issueAuthor.hasText();

    // Assert
    expect(hasText).toBe(false);
  });
});
