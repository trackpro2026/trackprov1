import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SlaughterhouseDocument = Slaughterhouse & Document;

export enum SlaughterhouseStatus {
  Pending = 'pending',
  Approved = 'approved',
  Suspended = 'suspended',
}

@Schema({ timestamps: true })
export class Slaughterhouse {
  /** Display id e.g. SH-001 (Figma) */
  @Prop({ unique: true, sparse: true })
  facilityCode?: string;

  @Prop({ type: String, index: true })
  ownerId?: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  location: string;

  @Prop()
  state?: string;

  @Prop()
  licenseNumber?: string;

  @Prop()
  contactPhone?: string;

  @Prop()
  ownerName?: string;

  @Prop()
  latitude?: number;

  @Prop()
  longitude?: number;

  @Prop({ default: SlaughterhouseStatus.Pending, enum: Object.values(SlaughterhouseStatus) })
  status: SlaughterhouseStatus;

  @Prop()
  notes?: string;
}

export const SlaughterhouseSchema = SchemaFactory.createForClass(Slaughterhouse);
SlaughterhouseSchema.index({ status: 1, name: 1 });
