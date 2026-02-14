const API_STARTUP_MESSAGE_PREFIX = 'AI-PR-Sentinel API';
const HEALTH_PATH = '/health';
const LOCALHOST = 'http://localhost';

interface ResolveApiStartupLogMessagesParams {
  version: string;
  port: number;
}

interface ApiStartupLogMessages {
  startupMessage: string;
  healthMessage: string;
}

export const resolveApiStartupLogMessages = ({
  version,
  port,
}: ResolveApiStartupLogMessagesParams): ApiStartupLogMessages => ({
  startupMessage: `${API_STARTUP_MESSAGE_PREFIX} v${version} running on port ${port}`,
  healthMessage: `Health check available at ${LOCALHOST}:${port}${HEALTH_PATH}`,
});
