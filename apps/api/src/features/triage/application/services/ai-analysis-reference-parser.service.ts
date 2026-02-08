import { isObjectRecord } from './ai-analysis.types';

export const parseIssueNumberFromReference = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value > 0 ? value : null;
  }

  if (typeof value === 'string') {
    const exactParsedNumber = Number(value.replace('#', '').trim());
    if (Number.isInteger(exactParsedNumber) && exactParsedNumber > 0) {
      return exactParsedNumber;
    }

    const numericMatch = value.match(/#?\s*(\d+)/);
    const extractedNumber = numericMatch?.[1] ? Number(numericMatch[1]) : Number.NaN;
    if (Number.isInteger(extractedNumber) && extractedNumber > 0) {
      return extractedNumber;
    }
  }

  if (isObjectRecord(value)) {
    const nestedIssueNumber =
      parseIssueNumberFromReference(value.number) ??
      parseIssueNumberFromReference(value.issueNumber) ??
      parseIssueNumberFromReference(value.id) ??
      parseIssueNumberFromReference(value.originalIssueNumber);
    if (nestedIssueNumber !== null) {
      return nestedIssueNumber;
    }
  }

  return null;
};

export const parseFirstValidDuplicateIssue = (
  duplicateOf: unknown,
  currentIssueNumber: number,
): number | null => {
  const duplicateReferences = Array.isArray(duplicateOf) ? duplicateOf : [duplicateOf];

  for (const duplicateReference of duplicateReferences) {
    const parsedIssueNumber = parseIssueNumberFromReference(duplicateReference);
    if (parsedIssueNumber !== null && parsedIssueNumber !== currentIssueNumber) {
      return parsedIssueNumber;
    }
  }

  return null;
};

export const normalizeSuggestedResponse = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    return normalizedValue.length > 0 ? normalizedValue : undefined;
  }

  if (Array.isArray(value)) {
    const normalizedLines = value
      .filter((item): item is string => typeof item === 'string')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (normalizedLines.length > 0) {
      return normalizedLines.join('\n');
    }
  }

  return undefined;
};
