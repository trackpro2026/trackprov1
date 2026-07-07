import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { UserAccountState } from '../../user/entities/user-account-state.enum';

export class AdminListFarmersQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by name, email, phone, or farm name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: UserAccountState })
  @IsOptional()
  @IsEnum(UserAccountState)
  userState?: UserAccountState;
}
