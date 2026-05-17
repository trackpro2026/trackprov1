import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ValidationPipe } from '../src/common/pipes/validation.pipe';
import { EmailService } from '../src/integrations/email/email.service';
import { signupAndLogin } from './test-helpers';

describe('Livestock modules (integration)', () => {
  let app: INestApplication;
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

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
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

  it('animal CRUD flow', async () => {
    const created = await request(app.getHttpServer())
      .post('/animals')
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
      .get(`/animals/${animalId}`)
      .set('Authorization', `Bearer ${farmerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/animals/${animalId}`)
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({ weightKg: 455 })
      .expect(200);
  });

  it('tracking event updates weight', async () => {
    await request(app.getHttpServer())
      .post('/tracking')
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({
        animalId,
        recordedAt: new Date().toISOString(),
        type: 'weight',
        weightKg: 460,
      })
      .expect(201);

    const animal = await request(app.getHttpServer())
      .get(`/animals/${animalId}`)
      .set('Authorization', `Bearer ${farmerToken}`)
      .expect(200);
    expect(animal.body.weightKg).toBe(460);
  });

  it('farmer dashboard returns herd stats', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboard/farmer')
      .set('Authorization', `Bearer ${farmerToken}`)
      .expect(200);
    expect(res.body).toHaveProperty('animalStats');
    expect(res.body.animalStats.totalActive).toBeGreaterThanOrEqual(1);
  });
});
