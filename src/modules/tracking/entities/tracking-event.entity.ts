import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TrackingEventDocument = TrackingEvent & Document;

export enum TrackingEventType {
  Weight = 'weight',
  Location = 'location',
  Feeding = 'feeding',
  Movement = 'movement',
  Other = 'other',
}

@Schema({ timestamps: true })
export class TrackingEvent {
  @Prop({ type: Types.ObjectId, ref: 'Animal', required: true, index: true })
  animalId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  farmerId: Types.ObjectId;

  @Prop({ required: true })
  recordedAt: Date;

  @Prop({ required: true, enum: Object.values(TrackingEventType) })
  type: TrackingEventType;

  @Prop()
  weightKg?: number;

  @Prop()
  location?: string;

  @Prop()
  notes?: string;
}

export const TrackingEventSchema = SchemaFactory.createForClass(TrackingEvent);
