import { setDefaultResultOrder } from 'node:dns';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

/** Prefer IPv4 for outbound connections (many PaaS hosts have broken IPv6 routes to SMTP). */
setDefaultResultOrder('ipv4first');
import { AppModule } from './app.module';
import { configureCloudinary } from './integrations/cloudinary/cloudinary.config';
import { configureApp } from './common/bootstrap/configure-app';
import { printStartupBanner } from './common/bootstrap/startup-banner';

async function bootstrap() {
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    configureCloudinary();
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  if (process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
  }

  configureApp(app);

  const port = Number(process.env.PORT) || 3000;
  const swaggerEnabled = process.env.SWAGGER_ENABLED !== 'false';
  await app.listen(port);
  printStartupBanner(port, swaggerEnabled);
}
bootstrap();
