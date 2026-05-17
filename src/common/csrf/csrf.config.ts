/** Header web clients send after fetching a CSRF token (cookie-based sessions only). */
export const CSRF_HEADER_NAME = 'x-csrf-token';

/** Cookie storing the CSRF token (double-submit). */
export const CSRF_COOKIE_NAME = 'csrf_token';

/** Optional: `mobile` | `web` — for logging / future rate limits. */
export const CLIENT_PLATFORM_HEADER = 'x-client-platform';

export function isCsrfEnabled(): boolean {
  return process.env.CSRF_ENABLED === 'true' || process.env.CSRF_ENABLED === '1';
}

export function isUniversalCors(): boolean {
  return process.env.CORS_UNIVERSAL !== 'false';
}
