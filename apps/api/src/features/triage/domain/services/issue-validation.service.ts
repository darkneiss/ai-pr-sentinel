import type { Issue } from '../entities/issue.entity';

const MIN_TITLE_LENGTH = 10;
const MIN_DESCRIPTION_LENGTH = 30;

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export type IssueIntegrityValidator = (issue: Issue) => ValidationResult;

export const validateIssueIntegrity: IssueIntegrityValidator = (issue) => {
  const errors: string[] = [];
  const title = issue.title.trim();
  const description = issue.description.trim();
  const author = issue.author.trim();

  if (!title) {
    errors.push('Title is required');
  } else if (title.length < MIN_TITLE_LENGTH) {
    errors.push('Title is too short (min 10 chars)');
  }

  if (!description) {
    errors.push('Description is required');
  } else if (description.length < MIN_DESCRIPTION_LENGTH) {
    errors.push('Description is too short (min 30 chars) to be useful');
  }

  if (!author) {
    errors.push('Author is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
