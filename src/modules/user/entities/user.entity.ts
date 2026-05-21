import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role } from '../../../common/decorators/roles.decorator';
import { DoctorProfile, DoctorProfileSchema } from './doctor-profile.schema';
import {
  SlaughterhouseProfile,
  SlaughterhouseProfileSchema,
} from './slaughterhouse-profile.schema';
import { UserAccountState } from './user-account-state.enum';

export type UserDocument = User & Document;

@Schema({ _id: false })
export class UserSettings {
  @Prop({ default: true })
  emailNotifications?: boolean;

  @Prop({ default: true })
  pushNotifications?: boolean;

  @Prop({ default: true })
  healthAlerts?: boolean;

  @Prop({ default: 'en' })
  language?: string;

  @Prop({ default: 'UTC' })
  timezone?: string;
}

const UserSettingsSchema = SchemaFactory.createForClass(UserSettings);

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ type: String, enum: Object.values(Role), default: Role.Farmer })
  role: Role;

  @Prop({ enum: Object.values(UserAccountState), default: UserAccountState.Active })
  userState: UserAccountState;

  @Prop()
  phone?: string;

  /** Street address (vets / operators — Figma profile screens) */
  @Prop()
  address?: string;

  @Prop()
  latitude?: number;

  @Prop()
  longitude?: number;

  @Prop()
  avatarUrl?: string;

  /** Farmer: farm / ranch name */
  @Prop()
  farmName?: string;

  @Prop()
  farmLocation?: string;

  @Prop()
  farmSizeHectares?: number;

  @Prop({ type: [String], default: [] })
  userFileUrls?: string[];

  @Prop({ type: [String], default: [] })
  adminFileUrls?: string[];

  @Prop({ type: UserSettingsSchema, default: () => ({}) })
  settings?: UserSettings;

  @Prop()
  refreshToken?: string;

  @Prop()
  passwordResetToken?: string;

  @Prop()
  resetUrlToken?: string;

  @Prop()
  passwordResetExpires?: Date;

  @Prop({ default: false })
  isEmailVerified?: boolean;

  @Prop()
  emailVerificationToken?: string;

  @Prop()
  emailVerificationExpires?: Date;

  @Prop({ type: DoctorProfileSchema })
  doctorProfile?: DoctorProfile;

  @Prop({ type: SlaughterhouseProfileSchema })
  slaughterhouseProfile?: SlaughterhouseProfile;

  /** Primary veterinarian for this farmer's herd (optional) */
  @Prop()
  assignedDoctorId?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
