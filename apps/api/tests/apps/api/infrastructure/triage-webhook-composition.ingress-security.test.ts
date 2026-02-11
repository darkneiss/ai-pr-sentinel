import type { GovernanceGateway } from '../../../../src/features/triage/application/ports/governance-gateway.port';
import { createTriageWebhookComposition } from '../../../../src/infrastructure/composition/triage-webhook-composition.factory';

const createLazyGovernanceGatewayMock = jest.fn();
const createLazyAnalyzeIssueWithAiMock = jest.fn();
const isAiTriageEnabledMock = jest.fn();
const resolveWebhookSignatureConfigMock = jest.fn();
const resolveWebhookIngressConfigMock = jest.fn();
const createInMemoryWebhookDeliveryAdapterMock = jest.fn();
const createStaticRepositoryAuthorizationAdapterMock = jest.fn();

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
jest.mock('../../../../src/infrastructure/composition/webhook-ingress-config.service', () => ({
  resolveWebhookIngressConfig: (...args: unknown[]) => resolveWebhookIngressConfigMock(...args),
}));
jest.mock('../../../../src/features/triage/infrastructure/adapters/in-memory-webhook-delivery.adapter', () => ({
  createInMemoryWebhookDeliveryAdapter: () => createInMemoryWebhookDeliveryAdapterMock(),
}));
jest.mock('../../../../src/features/triage/infrastructure/adapters/static-repository-authorization.adapter', () => ({
  createStaticRepositoryAuthorizationAdapter: (...args: unknown[]) =>
    createStaticRepositoryAuthorizationAdapterMock(...args),
}));

describe('TriageWebhookCompositionFactory ingress security dependencies', () => {
  it('should compose repository authorization and webhook delivery dependencies', () => {
    // Arrange
    const governanceGateway = {
      addLabels: jest.fn(),
      removeLabel: jest.fn(),
      createComment: jest.fn(),
      logValidatedIssue: jest.fn(),
    } as unknown as GovernanceGateway;
    createLazyGovernanceGatewayMock.mockReturnValue(governanceGateway);
    isAiTriageEnabledMock.mockReturnValue(false);
    resolveWebhookSignatureConfigMock.mockReturnValue({
      verifyWebhookSignature: false,
      webhookSecret: undefined,
    });
    resolveWebhookIngressConfigMock.mockReturnValue({
      allowedRepositories: ['org/repo'],
      strictRepositoryAllowlist: true,
      requireDeliveryId: true,
      deliveryTtlSeconds: 7200,
    });
    const webhookDeliveryGateway = {
      registerIfFirstSeen: jest.fn(),
    };
    const repositoryAuthorizationGateway = {
      isAllowed: jest.fn(),
    };
    createInMemoryWebhookDeliveryAdapterMock.mockReturnValue(webhookDeliveryGateway);
    createStaticRepositoryAuthorizationAdapterMock.mockReturnValue(repositoryAuthorizationGateway);

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
    expect(result.webhookDeliveryGateway).toBe(webhookDeliveryGateway);
    expect(result.webhookDeliveryTtlSeconds).toBe(7200);
    expect(result.requireDeliveryId).toBe(true);
    expect(result.repositoryAuthorizationGateway).toBe(repositoryAuthorizationGateway);
  });
});
