import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export enum Role {
  Farmer = 'farmer',
  Doctor = 'doctor',
  Slaughterhouse = 'slaughterhouse',
  Admin = 'admin',
}

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
