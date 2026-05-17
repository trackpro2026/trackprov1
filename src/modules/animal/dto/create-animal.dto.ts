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
  AnimalSex,
  AnimalSpecies,
  AnimalStatus,
} from '../entities/animal.entity';

export class CreateAnimalDto {
  @IsString()
  @MaxLength(80)
  tagId: string;

  @IsString()
  @MaxLength(120)
  name: string;

  @IsEnum(AnimalSpecies)
  species: AnimalSpecies;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  breed?: string;

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
