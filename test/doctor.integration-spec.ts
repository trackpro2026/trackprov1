import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from '../src/common/bootstrap/configure-app';
import { EmailService } from '../src/integrations/email/email.service';
import { activateUser, signupAndLogin, TEST_PASSWORD } from './test-helpers';
import { api } from './api-prefix';

describe('Doctor (integration)', () => {
  let app: NestExpressApplication;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_SECRET = 'integration-doctor-secret';
    process.env.SWAGGER_ENABLED = 'false';

    const { AppModule } = await import('../src/app.module');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue({
        isConfigured: () => true,
        sendMail: jest.fn().mockResolvedValue(undefined),
        sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
        sendLoginNotificationEmail: jest.fn().mockResolvedValue(undefined),
        sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
        sendPasswordChangedEmail: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app, { swagger: false });
    await app.init();
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
    if (mongod) await mongod.stop();
  });

  it('rejects farmer on doctor login', async () => {
    const email = 'not-doctor@example.com';
    await request(app.getHttpServer())
      .post(api('/auth/signup'))
      .send({ name: 'Regular Farmer', email, password: TEST_PASSWORD })
      .expect(201);

    await activateUser(app, email);

    await request(app.getHttpServer())
      .post(api('/auth/login/doctor'))
      .send({ email, password: TEST_PASSWORD })
      .expect(403);
  });

  it('doctor can complete profile and access dashboard', async () => {
    const token = await signupAndLogin(app, {
      name: 'Dr Test',
      email: 'doctor-int@example.com',
      role: 'doctor',
    });

    await request(app.getHttpServer())
      .patch(api('/doctor/profile'))
      .set('Authorization', `Bearer ${token}`)
      .send({
        clinicName: 'Valley Vet',
        licenseNumber: 'VET-123',
        specialties: ['cattle', 'goat'],
      })
      .expect(200);

    const dash = await request(app.getHttpServer())
      .get(api('/doctor/overview'))
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(dash.body).toHaveProperty('summaryCards');
    expect(dash.body.summaryCards).toHaveProperty('totalVisits');
    expect(dash.body).toHaveProperty('veterinaryVisitsTable');
  });
});
