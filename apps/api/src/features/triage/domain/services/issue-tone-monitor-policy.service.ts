export interface ShouldApplyIssueToneMonitorLabelInput {
  effectiveTone: 'positive' | 'neutral' | 'hostile';
}

export const shouldApplyIssueToneMonitorLabel = ({
  effectiveTone,
}: ShouldApplyIssueToneMonitorLabelInput): boolean => effectiveTone === 'hostile';
