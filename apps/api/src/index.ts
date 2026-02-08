import 'dotenv/config';

import { createApp } from './app';
import { createEnvLogger } from './shared/infrastructure/logging/env-logger';

const DEFAULT_PORT = 3000;
const portFromEnv = process.env.PORT;
const parsedPort = Number(portFromEnv);
const PORT = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT;
const logger = createEnvLogger();

// 1. Create the app instance (Dependency Injection)
const app = createApp();

// 2. Start the server
const server = app.listen(PORT, () => {
  logger.info(`AI-PR-Sentinel API running on port ${PORT}`);
  logger.info(`Health check available at http://localhost:${PORT}/health`);
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
