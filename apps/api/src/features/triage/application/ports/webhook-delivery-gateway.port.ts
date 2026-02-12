import type { WebhookDeliveryRegistry } from '../../domain/ports/webhook-delivery-registry.port';

export {
  WEBHOOK_DELIVERY_SOURCE_GITHUB,
  type RegisterWebhookDeliveryInput,
  type RegisterWebhookDeliveryResult,
  type UnregisterWebhookDeliveryInput,
  type WebhookDeliverySource,
} from '../../domain/ports/webhook-delivery-registry.port';

export interface WebhookDeliveryGateway extends WebhookDeliveryRegistry {}
