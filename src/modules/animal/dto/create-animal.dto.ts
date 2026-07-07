import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  AnimalHealthStatus,
  AnimalObtainedBy,
  AnimalSex,
  AnimalSpecies,
  AnimalStatus,
} from '../entities/animal.entity';

export class CreateAnimalDto {
  @ApiProperty({ example: 'EAR-001', description: 'Ear tag or RFID — unique per farm' })
  @IsString()
  @MaxLength(80)
  tagId: string;

  @ApiProperty({ example: 'Bessie' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: AnimalSpecies, example: AnimalSpecies.Cattle })
  @IsEnum(AnimalSpecies)
  species: AnimalSpecies;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  breed?: string;

  @ApiPropertyOptional({ example: 'Exotic', description: 'Figma breed type' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  breedType?: string;

  @ApiPropertyOptional({ example: '2024-04-18', description: 'Figma date obtained' })
  @IsOptional()
  @IsDateString()
  dateObtained?: string;

  @IsOptional()
  @IsEnum(AnimalSex)
  sex?: AnimalSex;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @IsOptional()
  @IsEnum(AnimalStatus)
  status?: AnimalStatus;

  @IsOptional()
  @IsEnum(AnimalHealthStatus)
  healthStatus?: AnimalHealthStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  pastureOrPen?: string;

  @ApiPropertyOptional({ enum: AnimalObtainedBy, example: AnimalObtainedBy.Native })
  @IsOptional()
  @IsEnum(AnimalObtainedBy)
  obtainedBy?: AnimalObtainedBy;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  assignedDoctorId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];
}
