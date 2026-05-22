import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListOperatorLivestockQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'cattle', description: 'Filter by species (Figma map/search)' })
  @IsOptional()
  @IsString()
  species?: string;
}
