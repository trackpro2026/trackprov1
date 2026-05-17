import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MongooseModule } from '@nestjs/mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../src/modules/auth/auth.module';
import { UserModule } from '../src/modules/user/user.module';
import { EncryptionModule } from '../src/core/encryption/encryption.module';
import { EmailModule } from '../src/integrations/email/email.module';
import { User, UserSchema } from '../src/modules/user/entities/user.entity';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { EmailService } from '../src/integrations/email/email.service';
import { activateUser, TEST_PASSWORD } from './test-helpers';
import type { Model } from 'mongoose';

describe('Auth (integration)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let userModel: Model<typeof User>;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'integration-test-secret';
    mongod = await MongoMemoryServer.create();
    const mongoUri = mongod.getUri();
    process.env.MONGODB_URI = mongoUri;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
          imports: [ConfigModule],
          useFactory: (config: ConfigService) => ({
            secret: config.get('JWT_SECRET') || 'integration-test-secret',
            signOptions: { expiresIn: '1h' as const },
          }),
          inject: [ConfigService],
        }),
        EncryptionModule,
        EmailModule,
        UserModule,
        AuthModule,
      ],
    })
      .overrideProvider(EmailService)
      .useValue({
        isConfigured: () => true,
        sendMail: jest.fn().mockResolvedValue(undefined),
        sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
        sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
        sendPasswordChangedEmail: jest.fn().mockResolvedValue(undefined),
        sendLoginNotificationEmail: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
    userModel = moduleFixture.get(getModelToken(User.name));
  }, 60000);

  afterAll(async () => {
    await app?.close();
    await mongod?.stop();
  });

  it('signs up a user', () => {
    return request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: 'John Doe', email: 'john@example.com', password: TEST_PASSWORD })
      .expect(201)
      .expect((res) => {
        expect(res.body.user.email).toBe('john@example.com');
        expect(res.body).toHaveProperty('accessToken');
      });
  });

  it('rejects duplicate email', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: 'Jane', email: 'duplicate@example.com', password: TEST_PASSWORD })
      .expect(201);

    return request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: 'Jane Again', email: 'duplicate@example.com', password: 'otherpass' })
      .expect(409);
  });

  it('logs in after email verification', async () => {
    const email = 'logintest@example.com';
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: 'Login Test', email, password: TEST_PASSWORD })
      .expect(201);
    await activateUser(app, email);

    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: TEST_PASSWORD })
      .expect(201)
      .expect((res) => {
        expect(res.body.accessToken).toBeDefined();
      });
  });

  it('rejects invalid login', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong' })
      .expect(401);
  });

  it('resets password with valid token', async () => {
    const email = 'reset@example.com';
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: 'Reset User', email, password: 'oldpassword' })
      .expect(201);

    const token = 'test-reset-token-123';
    await userModel.updateOne(
      { email },
      {
        passwordResetToken: token,
        resetUrlToken: token,
        passwordResetExpires: new Date(Date.now() + 3600000),
      },
    );

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token, newPassword: 'newpassword123' })
      .expect(201);

    await activateUser(app, email);
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'newpassword123' })
      .expect(201);
    expect(loginRes.body.accessToken).toBeDefined();
  });

  it('signs up doctor and logs in via doctor portal', async () => {
    const email = 'doctor-int@example.com';
    await request(app.getHttpServer())
      .post('/auth/signup/doctor')
      .send({ name: 'Dr Int', email, password: TEST_PASSWORD })
      .expect(201);
    await activateUser(app, email, { userState: 'active' as never });

    const res = await request(app.getHttpServer())
      .post('/auth/login/doctor')
      .send({ email, password: TEST_PASSWORD })
      .expect(201);
    expect(res.body.user.role).toBe('doctor');
  });
});
