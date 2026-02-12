import { IssueNumber } from '../../../../src/features/triage/domain/value-objects/issue-number.value-object';

describe('IssueNumberValueObject', () => {
  it('should create a value object for positive integers', () => {
    // Arrange
    const input = 42;

    // Act
    const result = IssueNumber.create(input);

    // Assert
    expect(result.value).toBe(42);
  });

  it('should parse issue number from unknown value', () => {
    // Arrange
    const input: unknown = '#98';

    // Act
    const result = IssueNumber.fromUnknown(input);

    // Assert
    expect(result?.value).toBe(98);
  });

  it('should parse issue number from unknown numeric value', () => {
    // Arrange
    const input: unknown = 67;

    // Act
    const result = IssueNumber.fromUnknown(input);

    // Assert
    expect(result?.value).toBe(67);
  });

  it('should return null for invalid numeric values from unknown input', () => {
    // Arrange
    const input: unknown = -5;

    // Act
    const result = IssueNumber.fromUnknown(input);

    // Assert
    expect(result).toBeNull();
  });

  it('should parse issue number from strings with embedded references', () => {
    // Arrange
    const input: unknown = 'possible duplicate of issue #120';

    // Act
    const result = IssueNumber.fromUnknown(input);

    // Assert
    expect(result?.value).toBe(120);
  });

  it('should return null for unknown value that cannot represent an issue number', () => {
    // Arrange
    const input: unknown = 'not-a-number';

    // Act
    const result = IssueNumber.fromUnknown(input);

    // Assert
    expect(result).toBeNull();
  });

  it('should return null for non-string and non-number values', () => {
    // Arrange
    const input: unknown = { issueNumber: 12 };

    // Act
    const result = IssueNumber.fromUnknown(input);

    // Assert
    expect(result).toBeNull();
  });

  it('should throw when creating value object with non-positive issue number', () => {
    // Arrange
    const input = 0;

    // Act
    const run = () => IssueNumber.create(input);

    // Assert
    expect(run).toThrow('Invalid issue number');
  });
});
