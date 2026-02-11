export const WEBHOOK_DELIVERY_SOURCE_GITHUB = 'github' as const;

export type WebhookDeliverySource = typeof WEBHOOK_DELIVERY_SOURCE_GITHUB;

export interface RegisterWebhookDeliveryInput {
  source: WebhookDeliverySource;
  deliveryId: string;
  receivedAt: Date;
  ttlSeconds: number;
}

export interface RegisterWebhookDeliveryResult {
  status: 'accepted' | 'duplicate';
}

export interface WebhookDeliveryGateway {
  registerIfFirstSeen(input: RegisterWebhookDeliveryInput): Promise<RegisterWebhookDeliveryResult>;
}
