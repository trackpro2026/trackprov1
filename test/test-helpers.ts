import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { getModelToken } from '@nestjs/mongoose';
import { User } from '../src/modules/user/entities/user.entity';
import { UserAccountState } from '../src/modules/user/entities/user-account-state.enum';
import type { Model } from 'mongoose';
import { api } from './api-prefix';

export const TEST_PASSWORD = 'password123';

export async function activateUser(
  app: INestApplication,
  email: string,
  overrides?: { userState?: UserAccountState; isEmailVerified?: boolean },
) {
  const userModel = app.get<Model<typeof User>>(getModelToken(User.name));
  const user = await userModel.findOne({ email: email.toLowerCase() }).exec();
  if (!user) {
    throw new Error(`activateUser: no user found for ${email}`);
  }
  await userModel.updateOne(
    { _id: user._id },
    {
      $set: {
        isEmailVerified: overrides?.isEmailVerified ?? true,
        ...(overrides?.userState ? { userState: overrides.userState } : {}),
      },
    },
  );
}

export async function signupAndLogin(
  app: INestApplication,
  opts: { email: string; name: string; role?: 'farmer' | 'doctor' | 'admin' },
): Promise<string> {
  const path =
    opts.role === 'doctor'
      ? api('/auth/signup/doctor')
      : opts.role === 'admin'
        ? api('/auth/signup/admin')
        : api('/auth/signup');

  await request(app.getHttpServer())
    .post(path)
    .send({ name: opts.name, email: opts.email, password: TEST_PASSWORD })
    .expect(201);

  if (opts.role === 'farmer' || !opts.role) {
    await activateUser(app, opts.email);
  } else if (opts.role === 'doctor') {
    await activateUser(app, opts.email, { userState: UserAccountState.Active });
  }

  const loginPath = opts.role === 'doctor' ? api('/auth/login/doctor') : api('/auth/login');
  const loginRes = await request(app.getHttpServer())
    .post(loginPath)
    .send({ email: opts.email, password: TEST_PASSWORD })
    .expect(201);

  return loginRes.body.accessToken as string;
}
