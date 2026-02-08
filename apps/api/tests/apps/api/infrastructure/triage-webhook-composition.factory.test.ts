import type { GovernanceGateway } from '../../../../src/features/triage/application/ports/governance-gateway.port';
import { createTriageWebhookComposition } from '../../../../src/infrastructure/composition/triage-webhook-composition.factory';

const createLazyGovernanceGatewayMock = jest.fn();
const createLazyAnalyzeIssueWithAiMock = jest.fn();
const isAiTriageEnabledMock = jest.fn();
const resolveWebhookSignatureConfigMock = jest.fn();

jest.mock('../../../../src/infrastructure/composition/lazy-governance-gateway.factory', () => ({
  createLazyGovernanceGateway: () => createLazyGovernanceGatewayMock(),
}));
jest.mock('../../../../src/infrastructure/composition/lazy-ai-triage-runner.factory', () => ({
  createLazyAnalyzeIssueWithAi: (...args: unknown[]) => createLazyAnalyzeIssueWithAiMock(...args),
  isAiTriageEnabled: () => isAiTriageEnabledMock(),
}));
jest.mock('../../../../src/infrastructure/composition/webhook-signature-config.service', () => ({
  resolveWebhookSignatureConfig: (...args: unknown[]) => resolveWebhookSignatureConfigMock(...args),
}));

describe('TriageWebhookCompositionFactory', () => {
  it('should compose governance gateway, AI runner and webhook secret', () => {
    // Arrange
    const governanceGateway = {
      addLabels: jest.fn(),
      removeLabel: jest.fn(),
      createComment: jest.fn(),
      logValidatedIssue: jest.fn(),
    } as unknown as GovernanceGateway;
    const analyzeIssueWithAi = jest.fn();
    createLazyGovernanceGatewayMock.mockReturnValue(governanceGateway);
    isAiTriageEnabledMock.mockReturnValue(true);
    createLazyAnalyzeIssueWithAiMock.mockReturnValue(analyzeIssueWithAi);
    resolveWebhookSignatureConfigMock.mockReturnValue({
      verifyWebhookSignature: true,
      webhookSecret: 'secret',
    });

    // Act
    const result = createTriageWebhookComposition({
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      config: {
        get: jest.fn(),
        getBoolean: jest.fn(),
      },
      questionResponseMetrics: {
        increment: jest.fn(),
        snapshot: jest.fn(),
      },
    });

    // Assert
    expect(result.governanceGateway).toBe(governanceGateway);
    expect(result.analyzeIssueWithAi).toBe(analyzeIssueWithAi);
    expect(result.webhookSecret).toBe('secret');
  });
});
