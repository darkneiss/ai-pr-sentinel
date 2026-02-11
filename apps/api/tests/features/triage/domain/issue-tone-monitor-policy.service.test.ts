import { shouldApplyIssueToneMonitorLabel } from '../../../../src/features/triage/domain/services/issue-tone-monitor-policy.service';

describe('IssueToneMonitorPolicyService', () => {
  it('should apply monitor label when tone is hostile', () => {
    // Arrange
    const input = {
      effectiveTone: 'hostile' as const,
    };

    // Act
    const result = shouldApplyIssueToneMonitorLabel(input);

    // Assert
    expect(result).toBe(true);
  });

  it('should not apply monitor label when tone is neutral', () => {
    // Arrange
    const input = {
      effectiveTone: 'neutral' as const,
    };

    // Act
    const result = shouldApplyIssueToneMonitorLabel(input);

    // Assert
    expect(result).toBe(false);
  });

  it('should not apply monitor label when tone is positive', () => {
    // Arrange
    const input = {
      effectiveTone: 'positive' as const,
    };

    // Act
    const result = shouldApplyIssueToneMonitorLabel(input);

    // Assert
    expect(result).toBe(false);
  });
});
