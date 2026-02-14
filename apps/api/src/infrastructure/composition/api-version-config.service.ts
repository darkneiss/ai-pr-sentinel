import type { ConfigPort } from '../../shared/application/ports/config.port';

const API_VERSION_ENV_VAR = 'API_VERSION';
const APP_VERSION_ENV_VAR = 'APP_VERSION';
const NPM_PACKAGE_VERSION_ENV_VAR = 'npm_package_version';
const DEFAULT_API_VERSION = '0.0.1';

export const resolveApiVersion = (config: ConfigPort): string =>
  config.get(API_VERSION_ENV_VAR) ??
  config.get(APP_VERSION_ENV_VAR) ??
  config.get(NPM_PACKAGE_VERSION_ENV_VAR) ??
  DEFAULT_API_VERSION;
