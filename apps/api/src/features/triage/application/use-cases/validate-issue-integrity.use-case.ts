import type { Issue } from '../../domain/entities/issue.entity';
import type { ValidationResult } from './validate-issue-integrity.types';

export const validateIssueIntegrity = (issue: Issue): ValidationResult => {
  const errors: string[] = [];
  const title = issue.title.trim();
  const description = issue.description.trim();
  const author = issue.author.trim();

  // 1. Validate title
  if (!title) {
    errors.push('Title is required');
  } else if (title.length < 10) {
    errors.push('Title is too short (min 10 chars)');
  }

  // 2. Validate description
  if (!description) {
    errors.push('Description is required');
  } else if (description.length < 30) {
    errors.push('Description is too short (min 30 chars) to be useful');
  }

  // 3. Validate author
  if (!author) {
    errors.push('Author is required');
  }

  // Result
  return {
    isValid: errors.length === 0,
    errors,
  };
};
