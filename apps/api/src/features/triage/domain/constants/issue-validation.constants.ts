export const MIN_TITLE_LENGTH = 10;
export const MIN_DESCRIPTION_LENGTH = 30;

export const TITLE_REQUIRED_ERROR = 'Title is required';
export const TITLE_TOO_SHORT_ERROR = `Title is too short (min ${MIN_TITLE_LENGTH} chars)`;
export const DESCRIPTION_REQUIRED_ERROR = 'Description is required';
export const DESCRIPTION_TOO_SHORT_ERROR = `Description is too short (min ${MIN_DESCRIPTION_LENGTH} chars) to be useful`;
export const AUTHOR_REQUIRED_ERROR = 'Author is required';
export const SPAM_ERROR_MESSAGE = 'Content contains spam keywords';

export const SPAM_PATTERNS = [
  /\bcasino\b/i,
  /\bfree\s+money\b/i,
  /\bcheap\s+rolex\b/i,
  /\bcrypto\s+giveaway\b/i,
  /\bviagra\b/i,
  /\bgana\s+dinero\b/i,
  /\btrabaja(?:r)?\s+desde\s+casa\b/i,
  /\bwork(?:ing)?\s+from\s+home\b/i,
] as const;
