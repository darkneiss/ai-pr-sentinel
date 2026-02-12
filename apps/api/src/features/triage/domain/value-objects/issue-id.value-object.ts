export class IssueId {
  private constructor(private readonly rawValue: string) {}

  public static create(rawValue: string): IssueId {
    return new IssueId(rawValue);
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
}
