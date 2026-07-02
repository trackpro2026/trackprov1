import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import {
  CLIENT_PLATFORM_HEADER,
  CSRF_HEADER_NAME,
} from '../csrf/csrf.config';
import { isUniversalCors } from '../csrf/csrf.config';

/** Local dev frontends always permitted when NODE_ENV !== production. */
export const LOCAL_DEV_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
] as const;

/** Used when `CORS_UNIVERSAL=false` and `CORS_ORIGINS` is set. */
export const DEFAULT_CORS_ORIGINS = [
  'https://trackpro-web.vercel.app',
  'https://trackpro-admin.vercel.app',
  ...LOCAL_DEV_CORS_ORIGINS,
] as const;

export function getAllowedCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS?.trim();
  let origins: string[];
  if (raw === '*') {
    origins = ['*'];
  } else if (raw) {
    origins = raw.split(',').map((s) => s.trim()).filter(Boolean);
  } else {
    origins = [...DEFAULT_CORS_ORIGINS];
  }
  if (process.env.NODE_ENV !== 'production' && !origins.includes('*')) {
    origins = [...new Set([...origins, ...LOCAL_DEV_CORS_ORIGINS])];
  }
  return origins;
}

export function corsOriginDelegate(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
): void {
  const allowed = getAllowedCorsOrigins();
  if (!origin) {
    callback(null, true);
    return;
  }
  if (allowed.includes('*')) {
    callback(null, true);
    return;
  }
  callback(null, allowed.includes(origin));
}

const CORS_METHODS = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'];

const CORS_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'Accept',
  'Origin',
  'X-Requested-With',
  CSRF_HEADER_NAME,
  CLIENT_PLATFORM_HEADER,
];

/**
 * CORS for web browsers. Native mobile apps are not subject to CORS but may send
 * `Origin`; universal mode reflects any origin when enabled.
 */
export function getCorsOptions(): CorsOptions {
  const universal = isUniversalCors();
  const allowed = getAllowedCorsOrigins();

  return {
    origin: universal
      ? true
      : allowed.includes('*')
        ? true
        : corsOriginDelegate,
    credentials: true,
    methods: CORS_METHODS,
    allowedHeaders: CORS_ALLOWED_HEADERS,
    exposedHeaders: [CSRF_HEADER_NAME],
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };
}
