import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

export class ScanLivestockForVisitQueryDto {
  @ApiPropertyOptional({ example: 'EAR-001' })
  @ValidateIf((o) => !o.qrPayload && !o.animalId)
  @IsString()
  @IsNotEmpty()
  tagId?: string;

  @ApiPropertyOptional()
  @ValidateIf((o) => !o.qrPayload && !o.tagId)
  @IsString()
  @IsNotEmpty()
  animalId?: string;

  @ApiPropertyOptional({ example: 'trackpro:livestock:EAR-001:6650a1b2c3d4e5f6a7b8c9d0' })
  @ValidateIf((o) => !o.tagId && !o.animalId)
  @IsString()
  @IsNotEmpty()
  qrPayload?: string;
}
