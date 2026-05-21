import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from '../src/common/bootstrap/configure-app';
import { EmailService } from '../src/integrations/email/email.service';
import { emailServiceMock } from './email-mock';
import { activateUser, signupAndLogin, TEST_PASSWORD } from './test-helpers';
import { api } from './api-prefix';

describe('App (e2e)', () => {
  let app: NestExpressApplication;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_SECRET = 'e2e-test-secret';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.SWAGGER_ENABLED = 'false';

    const { AppModule } = await import('../src/app.module');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue(emailServiceMock)
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app, { swagger: false });
    await app.init();
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
    if (mongod) await mongod.stop();
  });

  it('/ (GET) - health check', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status', 'ok');
        expect(res.body.service).toBe('trackpro');
      });
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer()).get('/health').expect(200);
  });

  it('/doctors (GET) - public list', () => {
    return request(app.getHttpServer())
      .get(api('/doctors'))
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('items');
        expect(res.body).toHaveProperty('meta');
      });
  });

  it('/auth/signup (POST) - farmer registration', async () => {
    const res = await request(app.getHttpServer())
      .post(api('/auth/signup'))
      .send({ name: 'E2E Farmer', email: 'e2e@example.com', password: TEST_PASSWORD })
      .expect(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user.email).toBe('e2e@example.com');
    expect(res.body.user.role).toBe('farmer');
  });

  it('/auth/login (POST) - after email verified', async () => {
    const email = 'login-e2e@example.com';
    await request(app.getHttpServer())
      .post(api('/auth/signup'))
      .send({ name: 'Login Farmer', email, password: TEST_PASSWORD })
      .expect(201);
    await activateUser(app, email);
    const res = await request(app.getHttpServer())
      .post(api('/auth/login'))
      .send({ email, password: TEST_PASSWORD })
      .expect(201);
    expect(res.body).toHaveProperty('accessToken');
  });

  it('/users/me (GET) - requires auth', () => {
    return request(app.getHttpServer()).get(api('/users/me')).expect(401);
  });

  it('/users/me (GET) - with token', async () => {
    const token = await signupAndLogin(app, {
      name: 'Profile Farmer',
      email: 'profile-e2e@example.com',
    });
    const res = await request(app.getHttpServer())
      .get(api('/users/me'))
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.email).toBe('profile-e2e@example.com');
  });

  it('/livestock (POST) - register animal for farmer', async () => {
    const token = await signupAndLogin(app, {
      name: 'Animal Farmer',
      email: 'animal-e2e@example.com',
    });
    const res = await request(app.getHttpServer())
      .post(api('/livestock'))
      .set('Authorization', `Bearer ${token}`)
      .send({
        tagId: 'TAG-001',
        name: 'Bessie',
        species: 'cattle',
        sex: 'female',
      })
      .expect(201);
    expect(res.body.name).toBe('Bessie');
    expect(res.body.tagId).toBe('TAG-001');
  });

  it('/auth/login/doctor (POST) - veterinarian portal', async () => {
    const email = 'doctor-portal@example.com';
    await request(app.getHttpServer())
      .post(api('/auth/signup/doctor'))
      .send({ name: 'Dr Portal', email, password: TEST_PASSWORD })
      .expect(201);
    await activateUser(app, email, { userState: 'active' as never });
    const res = await request(app.getHttpServer())
      .post(api('/auth/login/doctor'))
      .send({ email, password: TEST_PASSWORD })
      .expect(201);
    expect(res.body.user.role).toBe('doctor');
  });

  it('/admin/analytics (GET) - admin only', async () => {
    const adminToken = await signupAndLogin(app, {
      name: 'E2E Admin',
      email: 'admin-e2e@example.com',
      role: 'admin',
    });
    const res = await request(app.getHttpServer())
      .get(api('/admin/analytics'))
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        farmers: expect.any(Number),
        doctors: expect.any(Number),
        animals: expect.any(Number),
        healthRecords: expect.any(Number),
      }),
    );
  });
});
