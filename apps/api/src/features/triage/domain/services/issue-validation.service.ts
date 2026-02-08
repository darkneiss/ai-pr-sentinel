import type { Issue } from '../entities/issue.entity';
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

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export type IssueIntegrityValidator = (issue: Issue) => ValidationResult;

const containsSpamContent = (content: string): boolean =>
  SPAM_PATTERNS.some((spamPattern) => spamPattern.test(content));

export const validateIssueIntegrity: IssueIntegrityValidator = (issue) => {
  const errors: string[] = [];
  const title = issue.title.trim();
  const description = issue.description.trim();
  const author = issue.author.trim();
  const issueContent = `${title}\n${description}`;

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

  if (containsSpamContent(issueContent)) {
    errors.push(SPAM_ERROR_MESSAGE);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
