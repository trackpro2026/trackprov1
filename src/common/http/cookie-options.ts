import { ConfigService } from '@nestjs/config';
import { jwtExpiresInToMs } from '../utils/jwt-expiry.util';

export type AppCookieOptions = {
  maxAge?: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  domain?: string;
};

/** Shared cookie flags for auth + CSRF (reads JWT_COOKIE_* env). */
export function buildAppCookieOptions(
  config: ConfigService,
  overrides?: Partial<AppCookieOptions>,
): AppCookieOptions {
  const expiresIn = config.get<string>('JWT_EXPIRES_IN') || '7d';
  const maxAgeMs = jwtExpiresInToMs(expiresIn);
  const sameSiteRaw = (config.get<string>('JWT_COOKIE_SAMESITE') || 'lax').toLowerCase();
  const sameSite = (
    ['lax', 'strict', 'none'].includes(sameSiteRaw) ? sameSiteRaw : 'lax'
  ) as 'lax' | 'strict' | 'none';

  const secureEnv = config.get<string>('JWT_COOKIE_SECURE');
  let secure =
    secureEnv === 'true'
      ? true
      : secureEnv === 'false'
        ? false
        : config.get<string>('NODE_ENV') === 'production';

  if (sameSite === 'none' && !secure) {
    secure = true;
  }

  const domainRaw = config.get<string>('JWT_COOKIE_DOMAIN')?.trim();
  const domain =
    domainRaw && domainRaw !== 'yourdomain.com' && !domainRaw.includes('localhost')
      ? domainRaw
      : undefined;

  return {
    maxAge: maxAgeMs,
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    ...(domain ? { domain } : {}),
    ...overrides,
  };
}

export function jwtCookieName(config: ConfigService): string {
  return config.get<string>('JWT_COOKIE_NAME')?.trim() || 'access_token';
}
