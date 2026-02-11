export class IssueDescription {
  private constructor(private readonly rawValue: string) {}

  public static create(rawValue: string): IssueDescription {
    return new IssueDescription(rawValue);
  }

  public get value(): string {
    return this.rawValue;
  }

  public get normalizedValue(): string {
    return this.rawValue.trim();
  }

  public hasText(): boolean {
    return this.normalizedValue.length > 0;
  }

  public hasMinLength(minimumLength: number): boolean {
    return this.normalizedValue.length >= minimumLength;
  }
}
