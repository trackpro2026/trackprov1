import Mailgen = require('mailgen');

/**
 * Returns a fresh Mailgen instance each time so FRONTEND_URL and EMAIL_LOGO_URL
 * are always read from the current process env (set at boot by NestJS ConfigModule).
 * Set EMAIL_LOGO_URL in your env to show your logo at the top of every email.
 */
export function getMailgen(): Mailgen {
  const logoUrl = process.env.EMAIL_LOGO_URL?.trim();
  return new Mailgen({
    theme: 'default',
    product: {
      name: 'Trackpro',
      link: process.env.FRONTEND_URL || 'https://trackpro-web.vercel.app',
      ...(logoUrl ? { logo: logoUrl, logoHeight: '140px' } : {}),
      copyright: 'Trackpro — Livestock Tracking',
    },
  });
}

