import 'dotenv/config';

import { createApp } from './app';
import { resolveApiPort } from './infrastructure/composition/api-port-config.service';
import { resolveApiStartupLogMessages } from './infrastructure/composition/api-startup-log-message.service';
import { resolveApiVersion } from './infrastructure/composition/api-version-config.service';
import { createEnvConfig } from './shared/infrastructure/config/env-config.adapter';
import { createEnvLogger } from './shared/infrastructure/logging/env-logger';

const config = createEnvConfig();
const PORT = resolveApiPort(config);
const API_VERSION = resolveApiVersion(config);
const startupLogMessages = resolveApiStartupLogMessages({ version: API_VERSION, port: PORT });
const logger = createEnvLogger();

// 1. Create the app instance (Dependency Injection)
const app = createApp();

// 2. Start the server
const server = app.listen(PORT, () => {
  logger.info(startupLogMessages.startupMessage);
  logger.info(startupLogMessages.healthMessage);
});

// 3. Graceful shutdown handling
// This ensures clean shutdown when the process is terminated (Docker/K8s).
const shutdown = (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
};

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
