import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { DoctorController } from './doctor.controller';

@Module({
  imports: [UserModule],
  controllers: [DoctorController],
})
export class DoctorModule {}
