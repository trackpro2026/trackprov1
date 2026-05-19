import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class HealthCheckDto {
  @IsString()
  @IsNotEmpty()
  image: string;

  @IsString()
  @IsNotEmpty()
  animalType: string;

  @IsString()
  @IsNotEmpty()
  animalId: string;
}

export class VetAssistantDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsIn(['en', 'pcm', 'ha', 'yo', 'ig'])
  language: 'en' | 'pcm' | 'ha' | 'yo' | 'ig';

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}

export class OutbreakCaseDto {
  @IsOptional()
  @IsString()
  animalId?: string;

  @IsOptional()
  @IsString()
  species?: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symptoms?: string[];

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  reportedAt?: string;
}

export class GuardianAgentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OutbreakCaseDto)
  recentCases: OutbreakCaseDto[];

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsNumber()
  lookbackDays?: number;
}

export class VaccinationEntryDto {
  @IsString()
  vaccineName: string;

  @IsOptional()
  @IsString()
  date?: string;
}

export class HealthHistoryEntryDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsString()
  visitDate?: string;

  @IsOptional()
  @IsString()
  vaccineName?: string;
}

export class HealthScorerDto {
  @IsString()
  @IsNotEmpty()
  animalId: string;

  @IsString()
  @IsNotEmpty()
  species: string;

  @IsOptional()
  @IsNumber()
  ageMonths?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VaccinationEntryDto)
  vaccinations?: VaccinationEntryDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HealthHistoryEntryDto)
  healthHistory?: HealthHistoryEntryDto[];

  @IsOptional()
  @IsString()
  currentHealthStatus?: string;

  @IsOptional()
  @IsNumber()
  weightKg?: number;
}

export class VaccinationRecordDto {
  @IsString()
  vaccineName: string;

  @IsOptional()
  @IsString()
  administeredAt?: string;
}

export class VaccinationSchedulerDto {
  @IsString()
  @IsNotEmpty()
  animalId: string;

  @IsString()
  @IsNotEmpty()
  species: string;

  @IsOptional()
  @IsNumber()
  ageMonths?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VaccinationRecordDto)
  vaccinations?: VaccinationRecordDto[];
}

export class DiagnosisCountDto {
  @IsString()
  name: string;

  @IsNumber()
  count: number;
}

export class LocationCountDto {
  @IsString()
  name: string;

  @IsNumber()
  cases: number;
}

export class ReportDataDto {
  @IsOptional()
  @IsNumber()
  totalCases?: number;

  @IsOptional()
  @IsObject()
  speciesBreakdown?: Record<string, number>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiagnosisCountDto)
  topDiagnoses?: DiagnosisCountDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LocationCountDto)
  locations?: LocationCountDto[];

  @IsOptional()
  @IsNumber()
  vaccinationsAdministered?: number;

  @IsOptional()
  @IsNumber()
  mortalityCount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReportGeneratorDto {
  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  dateFrom: string;

  @IsString()
  @IsNotEmpty()
  dateTo: string;

  @ValidateNested()
  @Type(() => ReportDataDto)
  data: ReportDataDto;
}
