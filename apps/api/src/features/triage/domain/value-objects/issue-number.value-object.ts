const ISSUE_NUMBER_MIN_VALUE = 1;
const ISSUE_NUMBER_PREFIX = '#';
const ISSUE_NUMBER_EMBEDDED_REGEX = /#?\s*(\d+)/;
const DIGITS_ONLY_REGEX = /^\d+$/;

export class IssueNumber {
  private constructor(public readonly value: number) {}

  public static create(value: number): IssueNumber {
    if (!IssueNumber.isValid(value)) {
      throw new Error(`Invalid issue number: "${value}"`);
    }

    return new IssueNumber(value);
  }

  public static fromUnknown(rawValue: unknown): IssueNumber | null {
    if (typeof rawValue === 'number') {
      return IssueNumber.fromNumber(rawValue);
    }

    if (typeof rawValue === 'string') {
      return IssueNumber.fromString(rawValue);
    }

    return null;
  }

  private static fromNumber(value: number): IssueNumber | null {
    return IssueNumber.isValid(value) ? new IssueNumber(value) : null;
  }

  private static fromString(rawValue: string): IssueNumber | null {
    const normalizedValue = rawValue.trim();
    const normalizedCandidate = normalizedValue.startsWith(ISSUE_NUMBER_PREFIX)
      ? normalizedValue.replace(ISSUE_NUMBER_PREFIX, '').trim()
      : normalizedValue;
    if (DIGITS_ONLY_REGEX.test(normalizedCandidate)) {
      return IssueNumber.fromNumber(Number(normalizedCandidate));
    }

    const embeddedNumericMatch = normalizedValue.match(ISSUE_NUMBER_EMBEDDED_REGEX);
    if (!embeddedNumericMatch?.[1] || !DIGITS_ONLY_REGEX.test(embeddedNumericMatch[1])) {
      return null;
    }

    return IssueNumber.fromNumber(Number(embeddedNumericMatch[1]));
  }

  private static isValid(value: number): boolean {
    return Number.isInteger(value) && value >= ISSUE_NUMBER_MIN_VALUE;
  }
}
