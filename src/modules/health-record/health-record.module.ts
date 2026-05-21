import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthRecord, HealthRecordSchema } from './entities/health-record.entity';
import { Animal, AnimalSchema } from '../animal/entities/animal.entity';
import { HealthRecordService } from './health-record.service';
import { VeterinaryVisitsController } from './veterinary-visits.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HealthRecord.name, schema: HealthRecordSchema },
      { name: Animal.name, schema: AnimalSchema },
    ]),
  ],
  controllers: [VeterinaryVisitsController],
  providers: [HealthRecordService],
  exports: [HealthRecordService],
})
export class HealthRecordModule {}
