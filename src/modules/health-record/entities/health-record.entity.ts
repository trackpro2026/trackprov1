import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type HealthRecordDocument = HealthRecord & Document;

export enum HealthRecordType {
  Checkup = 'checkup',
  Treatment = 'treatment',
  Vaccination = 'vaccination',
  Emergency = 'emergency',
  Surgery = 'surgery',
  Other = 'other',
}

/** Figma visit list status badges */
export enum VisitStatus {
  Pending = 'pending',
  Completed = 'completed',
}

@Schema({ timestamps: true })
export class HealthRecord {
  @Prop({ type: Types.ObjectId, ref: 'Animal', required: true, index: true })
  animalId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  doctorId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  farmerId: Types.ObjectId;

  @Prop({ required: true })
  visitDate: Date;

  @Prop({ required: true, enum: Object.values(HealthRecordType) })
  type: HealthRecordType;

  @Prop()
  reason?: string;

  @Prop({ default: VisitStatus.Pending, enum: Object.values(VisitStatus) })
  status: VisitStatus;

  @Prop()
  diagnosis?: string;

  @Prop()
  treatment?: string;

  @Prop()
  vaccineName?: string;

  @Prop()
  medication?: string;

  @Prop()
  notes?: string;

  @Prop()
  followUpDate?: Date;
}

export const HealthRecordSchema = SchemaFactory.createForClass(HealthRecord);
