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
import { IssueDescription } from '../value-objects/issue-description.value-object';
import { IssueTitle } from '../value-objects/issue-title.value-object';

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
  #issueTitle: IssueTitle;
  #issueDescription: IssueDescription;

  private constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly description: string,
    public readonly author: string,
    public readonly createdAt: Date,
    issueTitle: IssueTitle,
    issueDescription: IssueDescription,
  ) {
    this.#issueTitle = issueTitle;
    this.#issueDescription = issueDescription;
  }

  public static create(input: Issue): IssueEntity {
    const issueTitle = IssueTitle.create(input.title);
    const issueDescription = IssueDescription.create(input.description);

    return new IssueEntity(
      input.id,
      issueTitle.value,
      issueDescription.value,
      input.author,
      input.createdAt,
      issueTitle,
      issueDescription,
    );
  }

  public static from(input: Issue | IssueEntity): IssueEntity {
    if (input instanceof IssueEntity) {
      return input;
    }

    return IssueEntity.create(input);
  }

  public getNormalizedTitle(): string {
    return this.#issueTitle.normalizedValue;
  }

  public getNormalizedDescription(): string {
    return this.#issueDescription.normalizedValue;
  }

  public getNormalizedAuthor(): string {
    return this.author.trim();
  }

  public getNormalizedContent(): string {
    return `${this.getNormalizedTitle()}${ISSUE_CONTENT_SEPARATOR}${this.getNormalizedDescription()}`;
  }

  public validateIntegrity(): IssueIntegrityValidationResult {
    const errors: string[] = [];
    const author = this.getNormalizedAuthor();
    const issueContent = this.getNormalizedContent();
    const hasTitle = this.#issueTitle.hasText();
    const hasDescription = this.#issueDescription.hasText();

    if (!hasTitle) {
      errors.push(TITLE_REQUIRED_ERROR);
    } else if (!this.#issueTitle.hasMinLength(MIN_TITLE_LENGTH)) {
      errors.push(TITLE_TOO_SHORT_ERROR);
    }

    if (!hasDescription) {
      errors.push(DESCRIPTION_REQUIRED_ERROR);
    } else if (!this.#issueDescription.hasMinLength(MIN_DESCRIPTION_LENGTH)) {
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
