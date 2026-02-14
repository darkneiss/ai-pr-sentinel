import type { ConfigPort } from '../../shared/application/ports/config.port';

const API_PORT_ENV_VAR = 'API_PORT';
const DEFAULT_API_PORT = 3000;

export const resolveApiPort = (config: ConfigPort): number => {
  const portFromEnv = config.get(API_PORT_ENV_VAR);
  const parsedPort = Number(portFromEnv);
  return Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_API_PORT;
};
