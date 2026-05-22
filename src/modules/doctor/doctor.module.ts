import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { HealthRecordModule } from '../health-record/health-record.module';
import { DoctorController } from './doctor.controller';

@Module({
  imports: [UserModule, HealthRecordModule],
  controllers: [DoctorController],
})
export class DoctorModule {}
