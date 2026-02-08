import type { ConfigPort } from '../../application/ports/config.port';

const TRUE_BOOLEAN_STRING = 'true';
const FALSE_BOOLEAN_STRING = 'false';

const parseBooleanValue = (value: string | undefined): boolean | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === TRUE_BOOLEAN_STRING) {
    return true;
  }

  if (normalizedValue === FALSE_BOOLEAN_STRING) {
    return false;
  }

  return undefined;
};

export const createEnvConfig = (): ConfigPort => ({
  get: (key: string): string | undefined => process.env[key],
  getBoolean: (key: string): boolean | undefined => parseBooleanValue(process.env[key]),
});
