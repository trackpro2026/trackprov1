import { RequestMethod } from '@nestjs/common';

/** Global REST prefix for all API controllers (e.g. `/api/v1/auth/login`). */
export const API_PREFIX = 'api/v1';

/** Swagger UI path (excluded from global prefix). */
export const SWAGGER_PATH = 'api/docs';

/** Routes that remain at the server root (health checks, static redirects, docs). */
export const API_PREFIX_EXCLUDES = [
  { path: '', method: RequestMethod.GET },
  { path: 'health', method: RequestMethod.GET },
  { path: 'forgot-password', method: RequestMethod.GET },
  { path: SWAGGER_PATH, method: RequestMethod.GET },
  { path: `${SWAGGER_PATH}-json`, method: RequestMethod.GET },
  { path: `${SWAGGER_PATH}-yaml`, method: RequestMethod.GET },
];
