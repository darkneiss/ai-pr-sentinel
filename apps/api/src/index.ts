import 'dotenv/config';

import { createApp } from './app';

const DEFAULT_PORT = 3000;
const portFromEnv = process.env.PORT;
const parsedPort = Number(portFromEnv);
const PORT = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT;

// 1. Creamos la instancia de la aplicación (Inyección de Dependencias)
const app = createApp();

// 2. Arrancamos el servidor
const server = app.listen(PORT, () => {
  console.log(`AI-PR-Sentinel API running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});

// 3. Manejo de cierre elegante (Graceful Shutdown)
// Esto es un detalle Senior: asegura que si matas el proceso (Docker/K8s),
// se cierren las conexiones limpiamente.
const shutdown = (signal: string) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
};

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
