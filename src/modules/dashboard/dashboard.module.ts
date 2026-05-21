import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Animal, AnimalSchema } from '../animal/entities/animal.entity';
import { HealthRecord, HealthRecordSchema } from '../health-record/entities/health-record.entity';
import { User, UserSchema } from '../user/entities/user.entity';
import { AnimalModule } from '../animal/animal.module';
import { HealthRecordModule } from '../health-record/health-record.module';
import { SlaughterhouseModule } from '../slaughterhouse/slaughterhouse.module';

@Module({
  imports: [
    AnimalModule,
    HealthRecordModule,
    SlaughterhouseModule,
    MongooseModule.forFeature([
      { name: Animal.name, schema: AnimalSchema },
      { name: HealthRecord.name, schema: HealthRecordSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
