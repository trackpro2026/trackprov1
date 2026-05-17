import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, isCsrfEnabled } from './csrf.config';
import { jwtCookieName } from '../http/cookie-options';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection for browser clients using httpOnly JWT cookies.
 * Skipped when `Authorization: Bearer` is present (mobile + typical SPAs).
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    if (!isCsrfEnabled() || SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    const authHeader = req.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const accessCookie = jwtCookieName(this.config);
    const usesSessionCookie = Boolean(req.cookies?.[accessCookie]);
    if (!usesSessionCookie) {
      next();
      return;
    }

    const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME] as string | undefined;

    if (!headerToken || !cookieToken || headerToken !== cookieToken) {
      throw new ForbiddenException(
        'CSRF token missing or invalid. Call GET /api/v1/auth/csrf first and send the token in the X-CSRF-Token header.',
      );
    }

    next();
  }
}
