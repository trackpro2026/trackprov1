import {
  IsOptional,
  IsString,
  MaxLength,
  IsUrl,
  IsNumber,
  Min,
  IsEnum,
} from 'class-validator';
import { UserGender } from '../entities/user.entity';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  farmName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  farmLocation?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  farmSizeHectares?: number;

  @IsOptional()
  @IsString()
  assignedDoctorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}
