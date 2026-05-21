import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { CsrfModule } from './common/csrf/csrf.module';
import { CsrfMiddleware } from './common/csrf/csrf.middleware';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { DoctorModule } from './modules/doctor/doctor.module';
import { AnimalModule } from './modules/animal/animal.module';
import { HealthRecordModule } from './modules/health-record/health-record.module';
import { AdminModule } from './modules/admin/admin.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AiModule } from './modules/ai/ai.module';
import { SlaughterhouseModule } from './modules/slaughterhouse/slaughterhouse.module';
import { NotificationModule } from './modules/notification/notification.module';
import { MapModule } from './modules/map/map.module';
import { UploadModule } from './modules/upload/upload.module';
import { EncryptionModule } from './core/encryption/encryption.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { createThrottlerConfig } from './common/throttler/throttler.config';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createThrottlerConfig(config),
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/trackpro', {
      maxPoolSize: 10,
      minPoolSize: 5,
    }),
    EncryptionModule,
    CsrfModule,
    AuthModule,
    UserModule,
    DoctorModule,
    AnimalModule,
    HealthRecordModule,
    UploadModule,
    AdminModule,
    DashboardModule,
    AiModule,
    SlaughterhouseModule,
    NotificationModule,
    MapModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
