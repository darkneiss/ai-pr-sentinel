import {
  AUTHOR_REQUIRED_ERROR,
  DESCRIPTION_REQUIRED_ERROR,
  DESCRIPTION_TOO_SHORT_ERROR,
  MIN_DESCRIPTION_LENGTH,
  MIN_TITLE_LENGTH,
  SPAM_ERROR_MESSAGE,
  SPAM_PATTERNS,
  TITLE_REQUIRED_ERROR,
  TITLE_TOO_SHORT_ERROR,
} from '../constants/issue-validation.constants';

export interface Issue {
  id: string;
  title: string;
  description: string;
  author: string;
  createdAt: Date;
}

const ISSUE_CONTENT_SEPARATOR = '\n';

export interface IssueIntegrityValidationResult {
  isValid: boolean;
  errors: string[];
}

export class IssueEntity {
  private constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly description: string,
    public readonly author: string,
    public readonly createdAt: Date,
  ) {}

  public static create(input: Issue): IssueEntity {
    return new IssueEntity(input.id, input.title, input.description, input.author, input.createdAt);
  }

  public static from(input: Issue | IssueEntity): IssueEntity {
    if (input instanceof IssueEntity) {
      return input;
    }

    return IssueEntity.create(input);
  }

  public getNormalizedTitle(): string {
    return this.title.trim();
  }

  public getNormalizedDescription(): string {
    return this.description.trim();
  }

  public getNormalizedAuthor(): string {
    return this.author.trim();
  }

  public getNormalizedContent(): string {
    return `${this.getNormalizedTitle()}${ISSUE_CONTENT_SEPARATOR}${this.getNormalizedDescription()}`;
  }

  public validateIntegrity(): IssueIntegrityValidationResult {
    const errors: string[] = [];
    const title = this.getNormalizedTitle();
    const description = this.getNormalizedDescription();
    const author = this.getNormalizedAuthor();
    const issueContent = this.getNormalizedContent();

    if (!title) {
      errors.push(TITLE_REQUIRED_ERROR);
    } else if (title.length < MIN_TITLE_LENGTH) {
      errors.push(TITLE_TOO_SHORT_ERROR);
    }

    if (!description) {
      errors.push(DESCRIPTION_REQUIRED_ERROR);
    } else if (description.length < MIN_DESCRIPTION_LENGTH) {
      errors.push(DESCRIPTION_TOO_SHORT_ERROR);
    }

    if (!author) {
      errors.push(AUTHOR_REQUIRED_ERROR);
    }

    if (IssueEntity.containsSpamContent(issueContent)) {
      errors.push(SPAM_ERROR_MESSAGE);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private static containsSpamContent(content: string): boolean {
    return SPAM_PATTERNS.some((spamPattern) => spamPattern.test(content));
  }
}
