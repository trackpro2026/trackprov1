import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OAuth2Client } from 'google-auth-library';
import {
  createGmailOAuth2Client,
  sendViaGmailApi,
  type GmailOAuthConfig,
} from './gmail-oauth.transport';
import {
  buildLoginNotificationEmail,
  buildPasswordChangedEmail,
  buildPasswordResetEmail,
  buildVerificationEmail,
  type LoginNotificationParams,
  type VerificationVariant,
} from './templates';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private gmailOAuth2Client: OAuth2Client | null = null;
  private loggedReady = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Email not configured: set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI, GMAIL_REFRESH_TOKEN, and GMAIL_USER.',
      );
      return;
    }
    const skip =
      String(this.configService.get<string>('EMAIL_VERIFY_ON_BOOT') ?? '').toLowerCase() ===
      'false';
    if (skip) {
      this.logReady();
      return;
    }
    try {
      const cfg = this.getGmailOAuthConfig();
      if (!cfg) {
        throw new Error('Gmail OAuth config is incomplete');
      }
      const client = createGmailOAuth2Client(cfg);
      await client.getAccessToken();
      this.logReady();
      this.logger.log('Gmail OAuth email transport verified.');
    } catch (e) {
      this.logger.error(
        `Gmail OAuth verification failed: ${e instanceof Error ? e.message : String(e)}`,
        e instanceof Error ? e.stack : undefined,
      );
    }
  }

  private logReady(): void {
    if (this.loggedReady) {
      return;
    }
    this.loggedReady = true;
    this.logger.log('Email sends via Gmail OAuth (Gmail API).');
  }

  /** Supports both `GMAIL_*` and common `.env` aliases (`CLIENT_ID`, `REFRESH_TOKEN`, …). */
  private cfgTrim(...keys: string[]): string | undefined {
    for (const key of keys) {
      const v = this.configService.get<string>(key)?.trim();
      if (v) {
        return v;
      }
    }
    return undefined;
  }

  private getGmailOAuthConfig(): GmailOAuthConfig | null {
    const clientId = this.cfgTrim('GMAIL_CLIENT_ID', 'CLIENT_ID');
    const clientSecret = this.cfgTrim('GMAIL_CLIENT_SECRET', 'CLIENT_SECRET');
    const redirectUri = this.cfgTrim('GMAIL_REDIRECT_URI', 'REDIRECT_URI');
    const refreshToken = this.cfgTrim('GMAIL_REFRESH_TOKEN', 'REFRESH_TOKEN');
    const user = this.cfgTrim('GMAIL_USER', 'GMAIL_NAME');
    if (!clientId || !clientSecret || !redirectUri || !refreshToken || !user) {
      return null;
    }
    return {
      clientId,
      clientSecret,
      redirectUri,
      refreshToken,
      user,
    };
  }

  private getGmailOAuth2Client(): OAuth2Client {
    if (!this.gmailOAuth2Client) {
      const cfg = this.getGmailOAuthConfig();
      if (!cfg) {
        throw new Error('Gmail OAuth is not configured');
      }
      this.gmailOAuth2Client = createGmailOAuth2Client(cfg);
    }
    return this.gmailOAuth2Client;
  }

  private getMailFromAddress(): string {
    return (
      this.cfgTrim('GMAIL_FROM', 'GMAIL_USER', 'GMAIL_NAME') || 'noreply@trackpro.com'
    );
  }

  async sendMail(options: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error(
        'Email not configured: set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI, GMAIL_REFRESH_TOKEN, and GMAIL_USER.',
      );
    }
    this.logReady();
    const oauth2 = this.getGmailOAuth2Client();
    const from = this.getMailFromAddress();
    await sendViaGmailApi(oauth2, {
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  }

  isConfigured(): boolean {
    return this.getGmailOAuthConfig() !== null;
  }

  async sendVerificationEmail(
    to: string,
    name: string,
    otp: string,
    variant: VerificationVariant = 'repeat',
    userId?: string,
  ): Promise<void> {
    const { subject, html, text } = buildVerificationEmail(name, otp, variant, userId);
    await this.sendMail({ to, subject, html, text });
  }

  async sendPasswordResetEmail(
    to: string,
    name: string,
    userId: string,
    resetUrlToken: string,
  ): Promise<void> {
    const { subject, html, text } = buildPasswordResetEmail(name, userId, resetUrlToken);
    await this.sendMail({ to, subject, html, text });
  }

  async sendPasswordChangedEmail(to: string, name: string): Promise<void> {
    const { subject, html, text } = buildPasswordChangedEmail(name);
    await this.sendMail({ to, subject, html, text });
  }

  /** After each successful login (optional IP / User-Agent from request). */
  async sendLoginNotificationEmail(
    to: string,
    name: string,
    params: LoginNotificationParams,
  ): Promise<void> {
    const { subject, html, text } = buildLoginNotificationEmail(name, params);
    await this.sendMail({ to, subject, html, text });
  }
}
