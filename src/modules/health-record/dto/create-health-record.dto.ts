import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { HealthRecordType } from '../entities/health-record.entity';

export class CreateHealthRecordDto {
  @ApiProperty({ description: 'MongoDB _id of the animal' })
  @IsString()
  animalId: string;

  @ApiProperty({ example: '2026-05-17T12:00:00.000Z' })
  @IsDateString()
  visitDate: string;

  @ApiProperty({ enum: HealthRecordType, example: HealthRecordType.Vaccination })
  @IsEnum(HealthRecordType)
  type: HealthRecordType;

  @ApiPropertyOptional()
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
