import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class RecordSlaughterDto {
  @ApiPropertyOptional({ description: 'MongoDB animal _id (from scan response)' })
  @ValidateIf((o) => !o.tagId && !o.qrPayload)
  @IsString()
  @IsNotEmpty()
  animalId?: string;

  @ApiPropertyOptional({ example: 'EAR-001', description: 'Ear tag / Live ID from scan' })
  @ValidateIf((o) => !o.animalId && !o.qrPayload)
  @IsString()
  @MaxLength(80)
  tagId?: string;

  @ApiPropertyOptional({
    example: 'trackpro:livestock:EAR-001:6650a1b2c3d4e5f6a7b8c9d0',
    description: 'Raw QR payload from scan',
  })
  @ValidateIf((o) => !o.animalId && !o.tagId)
  @IsString()
  qrPayload?: string;

  @ApiPropertyOptional({ example: 450 })
  @IsOptional()
  @IsNumber()
  liveWeightKg?: number;

  @ApiPropertyOptional({ example: 280 })
  @IsOptional()
  @IsNumber()
  carcassWeightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  anteMortemNotes?: string;
}
