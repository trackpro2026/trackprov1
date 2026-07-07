import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

export class ScanLivestockQueryDto {
  @ApiPropertyOptional({ example: 'EAR-001', description: 'Ear tag / Live ID' })
  @ValidateIf((o) => !o.qrPayload && !o.animalId)
  @IsString()
  @IsNotEmpty()
  tagId?: string;

  @ApiPropertyOptional({ description: 'MongoDB animal _id' })
  @ValidateIf((o) => !o.qrPayload && !o.tagId)
  @IsString()
  @IsNotEmpty()
  animalId?: string;

  @ApiPropertyOptional({
    example: 'trackpro:livestock:EAR-001:6650a1b2c3d4e5f6a7b8c9d0',
    description: 'Decoded QR string',
  })
  @ValidateIf((o) => !o.tagId && !o.animalId)
  @IsString()
  @IsNotEmpty()
  qrPayload?: string;
}
