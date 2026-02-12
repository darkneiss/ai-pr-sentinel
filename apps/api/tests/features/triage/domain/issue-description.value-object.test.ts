import { IssueDescription } from '../../../../src/features/triage/domain/value-objects/issue-description.value-object';

describe('IssueDescriptionValueObject', () => {
  it('should expose raw and normalized values', () => {
    // Arrange
    const rawValue = '  Repro steps and context for the issue.  ';

    // Act
    const issueDescription = IssueDescription.create(rawValue);

    // Assert
    expect(issueDescription.value).toBe(rawValue);
    expect(issueDescription.normalizedValue).toBe('Repro steps and context for the issue.');
  });

  it('should report description text and minimum length checks', () => {
    // Arrange
    const issueDescription = IssueDescription.create('  tiny  ');

    // Act
    const hasText = issueDescription.hasText();
    const hasMinimumLength = issueDescription.hasMinLength(30);

    // Assert
    expect(hasText).toBe(true);
    expect(hasMinimumLength).toBe(false);
  });
});
