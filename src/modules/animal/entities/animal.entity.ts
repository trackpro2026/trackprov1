import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AnimalDocument = Animal & Document;

export enum AnimalSpecies {
  Cattle = 'cattle',
  Goat = 'goat',
  Sheep = 'sheep',
  Pig = 'pig',
  Poultry = 'poultry',
  Horse = 'horse',
  Other = 'other',
}

export enum AnimalSex {
  Male = 'male',
  Female = 'female',
  Unknown = 'unknown',
}

export enum AnimalStatus {
  Active = 'active',
  Sold = 'sold',
  Deceased = 'deceased',
  Quarantine = 'quarantine',
}

export enum AnimalHealthStatus {
  Healthy = 'healthy',
  Sick = 'sick',
  UnderTreatment = 'under_treatment',
  Unknown = 'unknown',
}

/** Figma livestock table: Obtained By */
export enum AnimalObtainedBy {
  Native = 'native',
  Acquired = 'acquired',
}

@Schema({ timestamps: true })
export class Animal {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  farmerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  assignedDoctorId?: Types.ObjectId;

  /** Ear tag / RFID / visual ID */
  @Prop({ required: true })
  tagId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: Object.values(AnimalSpecies) })
  species: AnimalSpecies;

  @Prop()
  breed?: string;

  @Prop({ enum: Object.values(AnimalSex), default: AnimalSex.Unknown })
  sex: AnimalSex;

  @Prop()
  dateOfBirth?: Date;

  @Prop()
  weightKg?: number;

  @Prop({ default: AnimalStatus.Active, enum: Object.values(AnimalStatus) })
  status: AnimalStatus;

  @Prop({ default: AnimalHealthStatus.Unknown, enum: Object.values(AnimalHealthStatus) })
  healthStatus: AnimalHealthStatus;

  @Prop()
  pastureOrPen?: string;

  @Prop({ enum: Object.values(AnimalObtainedBy), default: AnimalObtainedBy.Native })
  obtainedBy?: AnimalObtainedBy;

  @Prop()
  notes?: string;

  @Prop({ type: [String], default: [] })
  imageUrls?: string[];
}

export const AnimalSchema = SchemaFactory.createForClass(Animal);
AnimalSchema.index({ farmerId: 1, tagId: 1 }, { unique: true });
