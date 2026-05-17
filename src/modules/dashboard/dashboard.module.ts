import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Animal, AnimalSchema } from '../animal/entities/animal.entity';
import { HealthRecord, HealthRecordSchema } from '../health-record/entities/health-record.entity';
import { TrackingEvent, TrackingEventSchema } from '../tracking/entities/tracking-event.entity';
import { User, UserSchema } from '../user/entities/user.entity';
import { AnimalModule } from '../animal/animal.module';

@Module({
  imports: [
    AnimalModule,
    MongooseModule.forFeature([
      { name: Animal.name, schema: AnimalSchema },
      { name: HealthRecord.name, schema: HealthRecordSchema },
      { name: TrackingEvent.name, schema: TrackingEventSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
