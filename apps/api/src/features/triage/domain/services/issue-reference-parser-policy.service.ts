import { IssueNumber } from '../value-objects/issue-number.value-object';

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const parseIssueNumberFromReference = (value: unknown): number | null => {
  const parsedPrimitiveIssueNumber = IssueNumber.fromUnknown(value);
  if (parsedPrimitiveIssueNumber !== null) {
    return parsedPrimitiveIssueNumber.value;
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

export interface ParseFirstValidDuplicateIssueReferenceInput {
  duplicateOf: unknown;
  currentIssueNumber: number;
}

export const parseFirstValidDuplicateIssueReference = ({
  duplicateOf,
  currentIssueNumber,
}: ParseFirstValidDuplicateIssueReferenceInput): number | null => {
  const duplicateReferences = Array.isArray(duplicateOf) ? duplicateOf : [duplicateOf];

  for (const duplicateReference of duplicateReferences) {
    const parsedIssueNumber = parseIssueNumberFromReference(duplicateReference);
    if (parsedIssueNumber !== null && parsedIssueNumber !== currentIssueNumber) {
      return parsedIssueNumber;
    }
  }

  return null;
};
