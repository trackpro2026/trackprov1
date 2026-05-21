import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SlaughterRecordDocument = SlaughterRecord & Document;

export enum SlaughterRecordStatus {
  Scheduled = 'scheduled',
  InProgress = 'in_progress',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export enum SlaughterInspectionStatus {
  Pending = 'pending',
  Passed = 'passed',
  Failed = 'failed',
}

@Schema({ timestamps: true })
export class SlaughterRecord {
  @Prop({ type: Types.ObjectId, ref: 'Animal', required: true, index: true })
  animalId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  farmerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Slaughterhouse', required: true, index: true })
  slaughterhouseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  inspectorDoctorId?: Types.ObjectId;

  /** Denormalized for Figma tables */
  @Prop()
  animalName?: string;

  @Prop()
  species?: string;

  @Prop()
  healthStatusLabel?: string;

  @Prop({ required: true })
  scheduledDate: Date;

  @Prop()
  completedDate?: Date;

  @Prop()
  liveWeightKg?: number;

  @Prop()
  carcassWeightKg?: number;

  @Prop({
    default: SlaughterInspectionStatus.Pending,
    enum: Object.values(SlaughterInspectionStatus),
  })
  inspectionStatus: SlaughterInspectionStatus;

  @Prop({ default: SlaughterRecordStatus.Scheduled, enum: Object.values(SlaughterRecordStatus) })
  status: SlaughterRecordStatus;

  @Prop()
  certificateNumber?: string;

  @Prop()
  anteMortemNotes?: string;

  @Prop()
  postMortemNotes?: string;

  @Prop({ type: [String], default: [] })
  imageUrls?: string[];
}

export const SlaughterRecordSchema = SchemaFactory.createForClass(SlaughterRecord);
