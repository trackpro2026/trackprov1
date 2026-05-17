import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';

/** Same fields as a working Gmail OAuth2 setup. */
export type GmailOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
  /** Mailbox user (e.g. you@gmail.com) — must match the account that authorized the refresh token. */
  user: string;
};

export function createGmailOAuth2Client(cfg: GmailOAuthConfig): OAuth2Client {
  const oauth2Client = new google.auth.OAuth2(
    cfg.clientId,
    cfg.clientSecret,
    cfg.redirectUri,
  );
  oauth2Client.setCredentials({ refresh_token: cfg.refreshToken });
  return oauth2Client;
}

/**
 * Sends an email via the Gmail REST API (HTTPS only — no SMTP port needed).
 * Uses base64-encoded MIME parts so Gmail renders HTML correctly.
 */
export async function sendViaGmailApi(
  oauth2Client: OAuth2Client,
  options: {
    from: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
  },
): Promise<void> {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const b64 = (s: string) => Buffer.from(s, 'utf-8').toString('base64');

  let rawMessage: string;

  if (options.html) {
    const boundary = `mp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    rawMessage = [
      `From: ${options.from}`,
      `To: ${options.to}`,
      `Subject: ${options.subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      b64(options.text ?? ''),
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      b64(options.html),
      '',
      `--${boundary}--`,
    ].join('\r\n');
  } else {
    rawMessage = [
      `From: ${options.from}`,
      `To: ${options.to}`,
      `Subject: ${options.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      b64(options.text ?? ''),
    ].join('\r\n');
  }

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: Buffer.from(rawMessage).toString('base64url') },
  });
}
