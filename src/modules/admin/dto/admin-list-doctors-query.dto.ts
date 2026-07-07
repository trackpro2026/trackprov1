import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { DoctorStatus } from '../../user/entities/doctor-profile.schema';

export class AdminListDoctorsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: DoctorStatus })
  @IsOptional()
  @IsEnum(DoctorStatus)
  status?: DoctorStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
