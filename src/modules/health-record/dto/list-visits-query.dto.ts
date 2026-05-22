import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListVisitsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search reason, visit type, farmer or tag ID' })
  @IsOptional()
  @IsString()
  search?: string;
}
