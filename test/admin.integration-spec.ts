import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { EmailService } from '../src/integrations/email/email.service';
import { activateUser, signupAndLogin, TEST_PASSWORD } from './test-helpers';
import { DoctorStatus } from '../src/modules/user/entities/doctor-profile.schema';

describe('Admin (integration)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_SECRET = 'integration-admin-secret';
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

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
    if (mongod) await mongod.stop();
  });

  it('admin analytics and doctor approval flow', async () => {
    const adminToken = await signupAndLogin(app, {
      name: 'Admin Int',
      email: 'admin-int@example.com',
      role: 'admin',
    });

    const analytics = await request(app.getHttpServer())
      .get('/admin/analytics')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(analytics.body).toEqual(
      expect.objectContaining({
        farmers: expect.any(Number),
        doctors: expect.any(Number),
        animals: expect.any(Number),
        healthRecords: expect.any(Number),
      }),
    );

    const doctorEmail = 'doctor-approve@example.com';
    const doctorSignup = await request(app.getHttpServer())
      .post('/auth/signup/doctor')
      .send({ name: 'Pending Vet', email: doctorEmail, password: TEST_PASSWORD })
      .expect(201);
    const doctorId = doctorSignup.body.user.id;

    await request(app.getHttpServer())
      .patch(`/admin/doctors/${doctorId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: DoctorStatus.Approved })
      .expect(200);

    await activateUser(app, doctorEmail, { userState: 'active' as never });

    const doctors = await request(app.getHttpServer())
      .get('/admin/doctors')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(doctors.body.items.length).toBeGreaterThanOrEqual(1);

    const farmers = await request(app.getHttpServer())
      .get('/admin/farmers')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(farmers.body).toHaveProperty('items');
  });
});
