import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export enum SlaughterhouseOperatorStatus {
  PendingReview = 'pending_review',
  Approved = 'approved',
  Declined = 'declined',
  Active = 'active',
  Inactive = 'inactive',
}

@Schema({ _id: false })
export class SlaughterhouseProfile {
  @Prop()
  facilityName?: string;

  @Prop()
  location?: string;

  @Prop()
  state?: string;

  @Prop()
  licenseNumber?: string;

  @Prop()
  contactPhone?: string;

  @Prop({ type: [String], default: [] })
  documentUrls?: string[];

  @Prop()
  profileImageUrl?: string;

  @Prop({ type: String, enum: Object.values(SlaughterhouseOperatorStatus), default: SlaughterhouseOperatorStatus.PendingReview })
  status: SlaughterhouseOperatorStatus;

  /** Linked facility document id after profile completion */
  @Prop()
  facilityId?: string;
}

export const SlaughterhouseProfileSchema = SchemaFactory.createForClass(SlaughterhouseProfile);
