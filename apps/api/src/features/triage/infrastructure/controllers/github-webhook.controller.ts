import type { RequestHandler } from 'express';
import crypto from 'node:crypto';

import type { AnalyzeIssueWithAiInput, AnalyzeIssueWithAiResult } from '../../application/use-cases/analyze-issue-with-ai.use-case';
import type { GovernanceGateway } from '../../application/ports/governance-gateway.port';
import type { RepositoryAuthorizationGateway } from '../../application/ports/repository-authorization-gateway.port';
import {
  WEBHOOK_DELIVERY_SOURCE_GITHUB,
  type WebhookDeliveryGateway,
} from '../../application/ports/webhook-delivery-gateway.port';
import { processIssueWebhook } from '../../application/use-cases/process-issue-webhook.use-case';
import { createEnvLogger, type Logger } from '../../../../shared/infrastructure/logging/env-logger';

const GITHUB_DELIVERY_HEADER = 'x-github-delivery';
const DEFAULT_WEBHOOK_DELIVERY_TTL_SECONDS = 60 * 60 * 24;
const MISSING_DELIVERY_ID_ERROR = 'Missing X-GitHub-Delivery header';
const REPOSITORY_NOT_ALLOWED_ERROR = 'Repository not allowed';
const DUPLICATE_WEBHOOK_RESPONSE = { status: 'duplicate_ignored' } as const;

interface Dependencies {
  governanceGateway: GovernanceGateway;
  analyzeIssueWithAi?: (input: AnalyzeIssueWithAiInput) => Promise<AnalyzeIssueWithAiResult>;
  logger?: Logger;
  webhookSecret?: string;
  webhookDeliveryGateway?: WebhookDeliveryGateway;
  webhookDeliveryTtlSeconds?: number;
  requireDeliveryId?: boolean;
  repositoryAuthorizationGateway?: RepositoryAuthorizationGateway;
}

interface GithubIssueLabel {
  name: string;
}

interface GithubIssueWebhookPayload {
  action: string;
  issue: {
    number: number;
    title: string;
    body: string | null;
    user: {
      login: string;
    };
    labels: GithubIssueLabel[];
  };
  repository: {
    full_name: string;
  };
}

const isGithubIssueWebhookPayload = (value: unknown): value is GithubIssueWebhookPayload => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Record<string, unknown>;
  const issue = payload.issue as Record<string, unknown> | undefined;
  const repository = payload.repository as Record<string, unknown> | undefined;
  const user = issue?.user as Record<string, unknown> | undefined;
  const labels = issue?.labels;

  return (
    typeof payload.action === 'string' &&
    !!issue &&
    typeof issue.number === 'number' &&
    typeof issue.title === 'string' &&
    (typeof issue.body === 'string' || issue.body === null) &&
    !!user &&
    typeof user.login === 'string' &&
    Array.isArray(labels) &&
    labels.every(
      (label) =>
        !!label &&
        typeof label === 'object' &&
        typeof (label as Record<string, unknown>).name === 'string',
    ) &&
    !!repository &&
    typeof repository.full_name === 'string'
  );
};

export const createGithubWebhookController = ({
  governanceGateway,
  analyzeIssueWithAi,
  logger = createEnvLogger(),
  webhookSecret,
  webhookDeliveryGateway,
  webhookDeliveryTtlSeconds = DEFAULT_WEBHOOK_DELIVERY_TTL_SECONDS,
  requireDeliveryId = false,
  repositoryAuthorizationGateway,
}: Dependencies): RequestHandler => {
  const run = processIssueWebhook({ governanceGateway, analyzeIssueWithAi, logger });
  const hasWebhookSecret = typeof webhookSecret === 'string' && webhookSecret.length > 0;

  const hasValidWebhookSignature = (rawBody: Buffer, signatureHeader: string): boolean => {
    const expectedSignature = `sha256=${crypto
      .createHmac('sha256', webhookSecret as string)
      .update(rawBody)
      .digest('hex')}`;
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const providedBuffer = Buffer.from(signatureHeader, 'utf8');
    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  };

  return async (req, res) => {
    try {
      if (hasWebhookSecret) {
        const signatureHeader = req.header('x-hub-signature-256');
        const requestWithRawBody = req as typeof req & { rawBody?: Buffer };
        const rawBody = requestWithRawBody.rawBody;
        const hasValidSignature =
          typeof signatureHeader === 'string' &&
          rawBody instanceof Buffer &&
          hasValidWebhookSignature(rawBody, signatureHeader);

        if (!hasValidSignature) {
          res.status(401).json({ error: 'Invalid webhook signature' });
          return;
        }
      }

      const payload: unknown = req.body;
      if (!isGithubIssueWebhookPayload(payload)) {
        res.status(400).json({ error: 'Invalid GitHub issue webhook payload' });
        return;
      }

      const repositoryFullName = payload.repository.full_name;
      if (repositoryAuthorizationGateway && !repositoryAuthorizationGateway.isAllowed(repositoryFullName)) {
        logger.warn('GithubWebhookController repository rejected by allowlist policy.', {
          repositoryFullName,
        });
        res.status(403).json({ error: REPOSITORY_NOT_ALLOWED_ERROR });
        return;
      }

      const deliveryIdHeader = req.header(GITHUB_DELIVERY_HEADER);
      const deliveryId = typeof deliveryIdHeader === 'string' ? deliveryIdHeader.trim() : '';

      if (deliveryId.length === 0) {
        if (requireDeliveryId) {
          res.status(400).json({ error: MISSING_DELIVERY_ID_ERROR });
          return;
        }
        logger.warn('GithubWebhookController missing webhook delivery id header.', {
          repositoryFullName,
          deliveryHeader: GITHUB_DELIVERY_HEADER,
        });
      } else if (webhookDeliveryGateway) {
        const deliveryRegistrationResult = await webhookDeliveryGateway.registerIfFirstSeen({
          source: WEBHOOK_DELIVERY_SOURCE_GITHUB,
          deliveryId,
          receivedAt: new Date(),
          ttlSeconds: webhookDeliveryTtlSeconds,
        });

        if (deliveryRegistrationResult.status === 'duplicate') {
          logger.info('GithubWebhookController duplicate webhook delivery detected. Skipping processing.', {
            repositoryFullName,
            deliveryId,
          });
          res.status(200).json(DUPLICATE_WEBHOOK_RESPONSE);
          return;
        }
      }

      const result = await run({
        action: payload.action,
        repositoryFullName,
        issue: {
          number: payload.issue.number,
          title: payload.issue.title,
          body: payload.issue.body ?? '',
          author: payload.issue.user.login,
          labels: payload.issue.labels.map((label) => label.name),
        },
      });

      if (result.statusCode === 204) {
        res.status(204).send();
        return;
      }

      res.status(200).json({ status: 'ok' });
    } catch (error: unknown) {
      logger.error('GithubWebhookController failed processing issue webhook', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
};
