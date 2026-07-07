import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { SlaughterhouseStatus } from '../../slaughterhouse/entities/slaughterhouse.entity';

export class AdminListSlaughterhousesQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: SlaughterhouseStatus })
  @IsOptional()
  @IsEnum(SlaughterhouseStatus)
  status?: SlaughterhouseStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
