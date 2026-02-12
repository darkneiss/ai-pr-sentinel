const INVALID_ISSUE_CREATED_AT_ERROR = 'Invalid issue createdAt date';

const isValidDate = (value: Date): boolean => Number.isFinite(value.getTime());

export class IssueCreatedAt {
  private constructor(private readonly rawValue: Date) {}

  public static create(rawValue: Date): IssueCreatedAt {
    if (!isValidDate(rawValue)) {
      throw new Error(INVALID_ISSUE_CREATED_AT_ERROR);
    }

    return new IssueCreatedAt(rawValue);
  }

  public get value(): Date {
    return this.rawValue;
  }
}
