import type {
  RegisterWebhookDeliveryInput,
  RegisterWebhookDeliveryResult,
  UnregisterWebhookDeliveryInput,
  WebhookDeliveryGateway,
} from '../../application/ports/webhook-delivery-gateway.port';

const MIN_WEBHOOK_DELIVERY_TTL_SECONDS = 1;
const MILLISECONDS_PER_SECOND = 1000;

type EpochMilliseconds = number;

export const createInMemoryWebhookDeliveryAdapter = (): WebhookDeliveryGateway => {
  const deliveryIdToExpirationMap = new Map<string, EpochMilliseconds>();

  const getDeliveryKey = ({ source, deliveryId }: RegisterWebhookDeliveryInput): string => `${source}:${deliveryId}`;
  const getUnregisterDeliveryKey = ({ source, deliveryId }: UnregisterWebhookDeliveryInput): string =>
    `${source}:${deliveryId}`;

  const removeExpiredEntries = (nowMs: EpochMilliseconds): void => {
    for (const [deliveryKey, expiresAtMs] of deliveryIdToExpirationMap.entries()) {
      if (expiresAtMs <= nowMs) {
        deliveryIdToExpirationMap.delete(deliveryKey);
      }
    }
  };

  return {
    registerIfFirstSeen: async (input: RegisterWebhookDeliveryInput): Promise<RegisterWebhookDeliveryResult> => {
      const nowMs = Date.now();
      removeExpiredEntries(nowMs);

      const deliveryKey = getDeliveryKey(input);
      const hasStoredDelivery = deliveryIdToExpirationMap.has(deliveryKey);
      if (hasStoredDelivery) {
        return { status: 'duplicate' };
      }

      const normalizedTtlSeconds = Math.max(input.ttlSeconds, MIN_WEBHOOK_DELIVERY_TTL_SECONDS);
      const receivedAtMs = input.receivedAt.getTime();
      const expirationBaselineMs = Number.isFinite(receivedAtMs) ? Math.max(receivedAtMs, nowMs) : nowMs;
      const expiresAtMs = expirationBaselineMs + normalizedTtlSeconds * MILLISECONDS_PER_SECOND;
      deliveryIdToExpirationMap.set(deliveryKey, expiresAtMs);

      return { status: 'accepted' };
    },
    unregister: async (input: UnregisterWebhookDeliveryInput): Promise<void> => {
      const deliveryKey = getUnregisterDeliveryKey(input);
      deliveryIdToExpirationMap.delete(deliveryKey);
    },
  };
};
