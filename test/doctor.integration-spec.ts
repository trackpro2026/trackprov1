import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { EmailService } from '../src/integrations/email/email.service';
import { activateUser, signupAndLogin, TEST_PASSWORD } from './test-helpers';

describe('Doctor (integration)', () => {
  let app: INestApplication;
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

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
    if (mongod) await mongod.stop();
  });

  it('rejects farmer on doctor login', async () => {
    const email = 'not-doctor@example.com';
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ name: 'Regular Farmer', email, password: TEST_PASSWORD })
      .expect(201);

    await activateUser(app, email);

    await request(app.getHttpServer())
      .post('/auth/login/doctor')
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
      .patch('/doctor/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clinicName: 'Valley Vet',
        licenseNumber: 'VET-123',
        specialties: ['cattle', 'goat'],
      })
      .expect(200);

    const dash = await request(app.getHttpServer())
      .get('/dashboard/doctor')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(dash.body).toHaveProperty('assignedAnimalCount');
  });
});
