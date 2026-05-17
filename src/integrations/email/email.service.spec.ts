import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

function createModuleWithEnv(map: Record<string, unknown>) {
  return Test.createTestingModule({
    providers: [
      EmailService,
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn((key: string, defaultValue?: unknown) => {
            if (key in map) {
              return map[key];
            }
            return defaultValue;
          }),
        },
      },
    ],
  }).compile();
}

const gmailOAuthEnv = {
  GMAIL_CLIENT_ID: 'id.apps.googleusercontent.com',
  GMAIL_CLIENT_SECRET: 'secret',
  GMAIL_REDIRECT_URI: 'https://developers.google.com/oauthplayground',
  GMAIL_REFRESH_TOKEN: '1//token',
  GMAIL_USER: 'user@gmail.com',
  GMAIL_FROM: 'Trackpro <user@gmail.com>',
};

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module = await createModuleWithEnv(gmailOAuthEnv);
    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isConfigured', () => {
    it('returns true when all Gmail OAuth vars are set', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('returns true when Gmail OAuth uses CLIENT_ID / REFRESH_TOKEN aliases', async () => {
      const module = await createModuleWithEnv({
        CLIENT_ID: 'id.apps.googleusercontent.com',
        CLIENT_SECRET: 'secret',
        REDIRECT_URI: 'https://developers.google.com/oauthplayground',
        REFRESH_TOKEN: '1//token',
        GMAIL_NAME: 'user@gmail.com',
      });
      const s = module.get<EmailService>(EmailService);
      expect(s.isConfigured()).toBe(true);
    });

    it('returns false when Gmail OAuth is incomplete', async () => {
      const module = await createModuleWithEnv({
        GMAIL_CLIENT_ID: 'id.apps.googleusercontent.com',
      });
      const s = module.get<EmailService>(EmailService);
      expect(s.isConfigured()).toBe(false);
    });

    it('returns false when only SMTP-style vars are set (SMTP not supported)', async () => {
      const module = await createModuleWithEnv({
        SMTP_USER: 'test@gmail.com',
        SMTP_PASS: 'app-password',
      });
      const s = module.get<EmailService>(EmailService);
      expect(s.isConfigured()).toBe(false);
    });
  });

  describe('sendMail', () => {
    it('throws when Gmail OAuth is not configured', async () => {
      const module = await createModuleWithEnv({});
      const s = module.get<EmailService>(EmailService);
      await expect(
        s.sendMail({ to: 'a@b.com', subject: 'Hi', text: 'body' }),
      ).rejects.toThrow(/not configured/i);
    });
  });
});
