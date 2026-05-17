import { join } from 'node:path';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe } from '../pipes/validation.pipe';
import { getCorsOptions } from '../cors/cors.config';
import { setupSwagger } from '../swagger/swagger.setup';
import { API_PREFIX, API_PREFIX_EXCLUDES } from '../constants/api.constants';
export type ConfigureAppOptions = {
  swagger?: boolean;
};

/** Shared HTTP setup for `main.ts` and integration/e2e tests. */
export function configureApp(
  app: NestExpressApplication,
  options: ConfigureAppOptions = {},
): void {
  app.useStaticAssets(join(process.cwd(), 'public'), { index: false });
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors(getCorsOptions());
  app.setGlobalPrefix(API_PREFIX, { exclude: API_PREFIX_EXCLUDES });

  const swaggerEnabled =
    options.swagger !== false && process.env.SWAGGER_ENABLED !== 'false';
  if (swaggerEnabled) {
    setupSwagger(app);
  }
}
