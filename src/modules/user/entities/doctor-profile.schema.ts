import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export enum DoctorStatus {
  PendingReview = 'pending_review',
  Approved = 'approved',
  Declined = 'declined',
  Active = 'active',
  Inactive = 'inactive',
}

@Schema({ _id: false })
export class DoctorProfile {
  @Prop()
  clinicName?: string;

  @Prop()
  licenseNumber?: string;

  @Prop()
  location?: string;

  @Prop({ type: [String], default: [] })
  specialties?: string[];

  @Prop({ type: [String], default: [] })
  speciesTreated?: string[];

  @Prop()
  bio?: string;

  @Prop({ default: false })
  isVerified?: boolean;

  @Prop({ enum: DoctorStatus, default: DoctorStatus.PendingReview })
  status?: DoctorStatus;

  @Prop({ type: [String], default: [] })
  documentUrls?: string[];

  @Prop()
  profileImageUrl?: string;
}

export const DoctorProfileSchema = SchemaFactory.createForClass(DoctorProfile);
