import {
  WEBHOOK_DELIVERY_SOURCE_GITHUB,
  type RegisterWebhookDeliveryInput,
} from '../../../../src/features/triage/application/ports/webhook-delivery-gateway.port';
import { createInMemoryWebhookDeliveryAdapter } from '../../../../src/features/triage/infrastructure/adapters/in-memory-webhook-delivery.adapter';

const createRegisterInput = (overrides: Partial<RegisterWebhookDeliveryInput> = {}): RegisterWebhookDeliveryInput => ({
  source: WEBHOOK_DELIVERY_SOURCE_GITHUB,
  deliveryId: 'delivery-123',
  receivedAt: new Date('2026-02-11T10:00:00.000Z'),
  ttlSeconds: 60 * 60 * 24,
  ...overrides,
});

describe('InMemoryWebhookDeliveryAdapter', () => {
  it('should accept first webhook delivery', async () => {
    // Arrange
    const adapter = createInMemoryWebhookDeliveryAdapter();

    // Act
    const result = await adapter.registerIfFirstSeen(createRegisterInput());

    // Assert
    expect(result).toEqual({ status: 'accepted' });
  });

  it('should mark same webhook delivery as duplicate', async () => {
    // Arrange
    const adapter = createInMemoryWebhookDeliveryAdapter();
    const registerInput = createRegisterInput();
    await adapter.registerIfFirstSeen(registerInput);

    // Act
    const duplicateResult = await adapter.registerIfFirstSeen(registerInput);

    // Assert
    expect(duplicateResult).toEqual({ status: 'duplicate' });
  });

  it('should accept different webhook delivery ids', async () => {
    // Arrange
    const adapter = createInMemoryWebhookDeliveryAdapter();
    await adapter.registerIfFirstSeen(createRegisterInput());

    // Act
    const result = await adapter.registerIfFirstSeen(
      createRegisterInput({
        source: 'github',
        deliveryId: 'delivery-456',
      }),
    );

    // Assert
    expect(result).toEqual({ status: 'accepted' });
  });
});
