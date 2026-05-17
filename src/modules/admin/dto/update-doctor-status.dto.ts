import { IsEnum } from 'class-validator';
import { DoctorStatus } from '../../user/entities/doctor-profile.schema';

export class UpdateDoctorStatusDto {
  @IsEnum(DoctorStatus)
  status: DoctorStatus;
}
