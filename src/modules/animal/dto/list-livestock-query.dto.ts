import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import {
  AnimalHealthStatus,
  AnimalObtainedBy,
  AnimalSpecies,
} from '../entities/animal.entity';

export class ListLivestockQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: AnimalSpecies })
  @IsOptional()
  @IsEnum(AnimalSpecies)
  species?: AnimalSpecies;

  @ApiPropertyOptional({ enum: AnimalHealthStatus })
  @IsOptional()
  @IsEnum(AnimalHealthStatus)
  healthStatus?: AnimalHealthStatus;

  @ApiPropertyOptional({ enum: AnimalObtainedBy, description: 'Figma: Native / Acquired' })
  @IsOptional()
  @IsEnum(AnimalObtainedBy)
  obtainedBy?: AnimalObtainedBy;

  @ApiPropertyOptional({ description: 'Search tag ID or name' })
  @IsOptional()
  @IsString()
  search?: string;
}
