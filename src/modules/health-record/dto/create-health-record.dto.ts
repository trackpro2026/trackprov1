import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { HealthRecordType } from '../entities/health-record.entity';

export class CreateHealthRecordDto {
  @IsString()
  animalId: string;

  @IsDateString()
  visitDate: string;

  @IsEnum(HealthRecordType)
  type: HealthRecordType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  diagnosis?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  treatment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  vaccineName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  medication?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsDateString()
  followUpDate?: string;
}
