import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
} from 'class-validator';
import {
  SlaughterInspectionStatus,
  SlaughterRecordStatus,
} from '../entities/slaughter-record.entity';
import { SlaughterhouseStatus } from '../entities/slaughterhouse.entity';

export class CreateSlaughterhouseDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSlaughterhouseDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsEnum(SlaughterhouseStatus)
  status?: SlaughterhouseStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateSlaughterRecordDto {
  @IsString()
  @IsNotEmpty()
  animalId: string;

  @IsString()
  @IsNotEmpty()
  slaughterhouseId: string;

  @IsDateString()
  scheduledDate: string;

  @IsOptional()
  @IsNumber()
  liveWeightKg?: number;

  @IsOptional()
  @IsString()
  anteMortemNotes?: string;
}

export class UpdateSlaughterRecordDto {
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @IsOptional()
  @IsDateString()
  completedDate?: string;

  @IsOptional()
  @IsNumber()
  liveWeightKg?: number;

  @IsOptional()
  @IsNumber()
  carcassWeightKg?: number;

  @IsOptional()
  @IsEnum(SlaughterInspectionStatus)
  inspectionStatus?: SlaughterInspectionStatus;

  @IsOptional()
  @IsEnum(SlaughterRecordStatus)
  status?: SlaughterRecordStatus;

  @IsOptional()
  @IsString()
  certificateNumber?: string;

  @IsOptional()
  @IsString()
  anteMortemNotes?: string;

  @IsOptional()
  @IsString()
  postMortemNotes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];
}
