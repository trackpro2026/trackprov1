import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListTrackingQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter events to one animal' })
  @IsOptional()
  @IsMongoId()
  animalId?: string;
}
