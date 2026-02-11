export const normalizeSuggestedResponse = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    return normalizedValue.length > 0 ? normalizedValue : undefined;
  }

  if (Array.isArray(value)) {
    const normalizedLines = value
      .filter((item): item is string => typeof item === 'string')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (normalizedLines.length > 0) {
      return normalizedLines.join('\n');
    }
  }

  return undefined;
};
