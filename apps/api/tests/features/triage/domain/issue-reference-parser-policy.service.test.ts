import {
  parseFirstValidDuplicateIssueReference,
  parseIssueNumberFromReference,
} from '../../../../src/features/triage/domain/services/issue-reference-parser-policy.service';

describe('IssueReferenceParserPolicyService', () => {
  it('should parse positive integer references from numbers', () => {
    // Arrange
    const input = 42;

    // Act
    const result = parseIssueNumberFromReference(input);

    // Assert
    expect(result).toBe(42);
  });

  it('should parse positive integer references from strings', () => {
    // Arrange
    const input = '#123';

    // Act
    const result = parseIssueNumberFromReference(input);

    // Assert
    expect(result).toBe(123);
  });

  it('should parse positive integer references from nested objects', () => {
    // Arrange
    const input = {
      issueNumber: '98',
    };

    // Act
    const result = parseIssueNumberFromReference(input);

    // Assert
    expect(result).toBe(98);
  });

  it('should parse first valid duplicate issue different from current issue', () => {
    // Arrange
    const input = {
      duplicateOf: ['#77', '#80'],
      currentIssueNumber: 77,
    };

    // Act
    const result = parseFirstValidDuplicateIssueReference(input);

    // Assert
    expect(result).toBe(80);
  });

  it('should return null when no valid duplicate reference exists', () => {
    // Arrange
    const input = {
      duplicateOf: ['current issue'],
      currentIssueNumber: 77,
    };

    // Act
    const result = parseFirstValidDuplicateIssueReference(input);

    // Assert
    expect(result).toBeNull();
  });
});
