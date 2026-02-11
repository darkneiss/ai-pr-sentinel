type AiTone = 'positive' | 'neutral' | 'hostile';
type IssueKind = 'bug' | 'feature' | 'question';

export interface DecideIssueKindLabelActionsInput {
  targetKindLabel: string;
  classificationConfidence: number;
  classificationConfidenceThreshold: number;
  sentimentTone: AiTone;
  sentimentConfidence: number;
  sentimentConfidenceThreshold: number;
  existingLabels: string[];
  kindLabels: readonly string[];
}

export interface IssueKindLabelActionsDecision {
  labelsToAdd: string[];
  labelsToRemove: string[];
  wasSuppressedByHostileTone: boolean;
}

export interface ResolveIssueKindLabelInput {
  issueKind: IssueKind;
  bugLabel: string;
  featureLabel: string;
  questionLabel: string;
}

export const resolveIssueKindLabel = ({
  issueKind,
  bugLabel,
  featureLabel,
  questionLabel,
}: ResolveIssueKindLabelInput): string => {
  if (issueKind === 'bug') {
    return bugLabel;
  }

  if (issueKind === 'feature') {
    return featureLabel;
  }

  return questionLabel;
};

export const decideIssueKindLabelActions = ({
  targetKindLabel,
  classificationConfidence,
  classificationConfidenceThreshold,
  sentimentTone,
  sentimentConfidence,
  sentimentConfidenceThreshold,
  existingLabels,
  kindLabels,
}: DecideIssueKindLabelActionsInput): IssueKindLabelActionsDecision => {
  const shouldSuppressKindLabels = sentimentTone === 'hostile' && sentimentConfidence >= sentimentConfidenceThreshold;
  if (shouldSuppressKindLabels) {
    return {
      labelsToAdd: [],
      labelsToRemove: kindLabels.filter((label) => existingLabels.includes(label)),
      wasSuppressedByHostileTone: true,
    };
  }

  if (classificationConfidence < classificationConfidenceThreshold) {
    return {
      labelsToAdd: [],
      labelsToRemove: [],
      wasSuppressedByHostileTone: false,
    };
  }

  return {
    labelsToAdd: [targetKindLabel],
    labelsToRemove: kindLabels.filter((label) => label !== targetKindLabel && existingLabels.includes(label)),
    wasSuppressedByHostileTone: false,
  };
};
