import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthRecord, HealthRecordSchema } from './entities/health-record.entity';
import { Animal, AnimalSchema } from '../animal/entities/animal.entity';
import { User, UserSchema } from '../user/entities/user.entity';
import {
  SlaughterRecord,
  SlaughterRecordSchema,
} from '../slaughterhouse/entities/slaughter-record.entity';
import { HealthRecordService } from './health-record.service';
import { VeterinaryVisitsController } from './veterinary-visits.controller';
import { NotificationModule } from '../notification/notification.module';
import { AnimalModule } from '../animal/animal.module';

@Module({
  imports: [
    NotificationModule,
    AnimalModule,
    MongooseModule.forFeature([
      { name: HealthRecord.name, schema: HealthRecordSchema },
      { name: Animal.name, schema: AnimalSchema },
      { name: User.name, schema: UserSchema },
      { name: SlaughterRecord.name, schema: SlaughterRecordSchema },
    ]),
  ],
  controllers: [VeterinaryVisitsController],
  providers: [HealthRecordService],
  exports: [HealthRecordService],
})
export class HealthRecordModule {}
