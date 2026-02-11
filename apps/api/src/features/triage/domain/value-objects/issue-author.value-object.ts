export class IssueAuthor {
  private constructor(private readonly rawValue: string) {}

  public static create(rawValue: string): IssueAuthor {
    return new IssueAuthor(rawValue);
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
