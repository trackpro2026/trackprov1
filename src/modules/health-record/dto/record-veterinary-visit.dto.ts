import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { HealthRecordType, VisitStatus } from '../entities/health-record.entity';
import { AnimalHealthStatus } from '../../animal/entities/animal.entity';

/** Figma Add Visit — scan livestock then submit check result */
export class RecordVeterinaryVisitDto {
  @ApiPropertyOptional({ description: 'MongoDB animal _id (from scan)' })
  @ValidateIf((o) => !o.tagId && !o.qrPayload)
  @IsString()
  @IsNotEmpty()
  animalId?: string;

  @ApiPropertyOptional({ example: 'EAR-001' })
  @ValidateIf((o) => !o.animalId && !o.qrPayload)
  @IsString()
  @MaxLength(80)
  tagId?: string;

  @ApiPropertyOptional({ example: 'trackpro:livestock:EAR-001:6650a1b2c3d4e5f6a7b8c9d0' })
  @ValidateIf((o) => !o.animalId && !o.tagId)
  @IsString()
  qrPayload?: string;

  @ApiProperty({ example: '2026-04-15T10:00:00.000Z' })
  @IsDateString()
  visitDate: string;

  @ApiPropertyOptional({ enum: HealthRecordType, default: HealthRecordType.Checkup })
  @IsOptional()
  @IsEnum(HealthRecordType)
  type?: HealthRecordType;

  @ApiProperty({ example: 'Routine checkup', description: 'Figma Summary field' })
  @IsString()
  @MaxLength(2000)
  summary: string;

  @ApiPropertyOptional({
    enum: AnimalHealthStatus,
    description: 'Figma Check Result — updates livestock health status',
  })
  @IsOptional()
  @IsEnum(AnimalHealthStatus)
  healthStatus?: AnimalHealthStatus;

  @ApiPropertyOptional({ enum: VisitStatus, default: VisitStatus.Completed })
  @IsOptional()
  @IsEnum(VisitStatus)
  status?: VisitStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  diagnosis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  treatment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
