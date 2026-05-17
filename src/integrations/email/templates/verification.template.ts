import { getMailgen } from './mailgen.factory';

export type VerificationVariant = 'signup' | 'repeat';

export function buildVerificationEmail(
  name: string,
  otp: string,
  variant: VerificationVariant = 'repeat',
  userId?: string,
) {
  const mailgen = getMailgen();
  const baseUrl = process.env.FRONTEND_URL || 'https://trackpro-web.vercel.app';
  const apiUrl =
    process.env.BACKEND_URL ||
    process.env.API_URL ||
    'https://trackpro-backend.onrender.com';

  const verifyLink = `${baseUrl.replace(/\/$/, '')}/auth/verify-email`;
  const cancelLink = userId
    ? `${apiUrl.replace(/\/$/, '')}/auth/cancel-signup?${new URLSearchParams({ uid: userId, token: otp }).toString()}`
    : null;

  const intro =
    variant === 'signup'
      ? 'Welcome to Trackpro — your account is almost ready.'
      : 'You requested a new verification code for your Trackpro account.';

  const actions = [
    {
      instructions: 'Click the button below to go to the verification page:',
      button: {
        color: '#2563eb',
        text: 'Verify Email',
        link: verifyLink,
      },
    },
    ...(cancelLink
      ? [
          {
            instructions: 'Did not create this account?',
            button: {
              color: '#dc2626',
              text: 'Delete this account',
              link: cancelLink,
            },
          },
        ]
      : []),
  ];

  const email = {
    body: {
      name,
      intro: [
        intro,
        `Your verification code is: ${otp}`,
        'This code expires in 15 minutes.',
      ],
      action: actions,
      outro:
        'If you did not create this account and do not wish to delete it, you can safely ignore this email.',
    },
  };

  return {
    subject: 'Trackpro — Verify your email',
    html: mailgen.generate(email),
    text: mailgen.generatePlaintext(email),
  };
}
