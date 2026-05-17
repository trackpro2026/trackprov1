import {
  IsOptional,
  IsString,
  MaxLength,
  IsUrl,
  IsNumber,
  Min,
} from 'class-validator';

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
}
