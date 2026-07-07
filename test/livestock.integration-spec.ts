import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from '../src/common/bootstrap/configure-app';
import { EmailService } from '../src/integrations/email/email.service';
import { signupAndLogin } from './test-helpers';
import { api } from './api-prefix';

describe('Livestock modules (integration)', () => {
  let app: NestExpressApplication;
  let mongod: MongoMemoryServer;
  let farmerToken: string;
  let animalId: string;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_SECRET = 'integration-livestock-secret';
    process.env.JWT_EXPIRES_IN = '1h';
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
      })
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app, { swagger: false });
    await app.init();

    farmerToken = await signupAndLogin(app, {
      name: 'Livestock Farmer',
      email: 'livestock-int@example.com',
    });
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
    if (mongod) await mongod.stop();
  });

  it('livestock CRUD flow', async () => {
    const created = await request(app.getHttpServer())
      .post(api('/livestock'))
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({
        tagId: 'EAR-100',
        name: 'Daisy',
        species: 'cattle',
        weightKg: 450,
      })
      .expect(201);
    animalId = created.body._id;
    expect(created.body.name).toBe('Daisy');

    await request(app.getHttpServer())
      .get(api(`/livestock/${animalId}`))
      .set('Authorization', `Bearer ${farmerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(api(`/livestock/${animalId}`))
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({ weightKg: 455 })
      .expect(200);
  });

  it('farmer dashboard returns herd stats', async () => {
    const res = await request(app.getHttpServer())
      .get(api('/farmer/overview'))
      .set('Authorization', `Bearer ${farmerToken}`)
      .expect(200);
    expect(res.body).toHaveProperty('summaryCards');
    expect(res.body.summaryCards.totalLivestock).toBeGreaterThanOrEqual(1);
    expect(res.body).toHaveProperty('livestockTable');
  });

  it('returns QR code PNG data URL for livestock', async () => {
    const res = await request(app.getHttpServer())
      .get(api(`/livestock/${animalId}/qr-code`))
      .set('Authorization', `Bearer ${farmerToken}`)
      .expect(200);
    expect(res.body).toHaveProperty('qrPayload');
    expect(res.body.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
  });
});
