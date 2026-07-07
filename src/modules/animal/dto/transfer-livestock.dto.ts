import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class TransferLivestockDto {
  @ApiProperty({ example: 'Jane' })
  @IsString()
  @MaxLength(80)
  receiverFirstName: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  receiverLastName?: string;

  @ApiProperty({ example: '+2349012345678', description: 'Receiver farmer phone (matched to account)' })
  @IsString()
  @MaxLength(20)
  receiverPhone: string;

  @ApiPropertyOptional({ example: 'jane@farm.com' })
  @IsOptional()
  @IsEmail()
  receiverEmail?: string;
}
