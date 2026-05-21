import { IsArray, IsOptional, IsString, MaxLength, IsUrl } from 'class-validator';

export class CompleteSlaughterhouseProfileDto {
  @IsString()
  @MaxLength(120)
  facilityName: string;

  @IsString()
  @MaxLength(200)
  location: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  documentUrls?: string[];

  @IsOptional()
  @IsUrl()
  profileImageUrl?: string;
}
