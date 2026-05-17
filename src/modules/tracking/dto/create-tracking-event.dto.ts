import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TrackingEventType } from '../entities/tracking-event.entity';

export class CreateTrackingEventDto {
  @IsString()
  animalId: string;

  @IsDateString()
  recordedAt: string;

  @IsEnum(TrackingEventType)
  type: TrackingEventType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
