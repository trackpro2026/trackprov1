import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Animal, AnimalSchema } from './entities/animal.entity';
import { User, UserSchema } from '../user/entities/user.entity';
import { AnimalService } from './animal.service';
import { LivestockController } from './livestock.controller';
import { NotificationModule } from '../notification/notification.module';
import { HealthRecord, HealthRecordSchema } from '../health-record/entities/health-record.entity';
import { FarmerPortalController } from './farmer-portal.controller';

@Module({
  imports: [
    NotificationModule,
    MongooseModule.forFeature([
      { name: Animal.name, schema: AnimalSchema },
      { name: User.name, schema: UserSchema },
      { name: HealthRecord.name, schema: HealthRecordSchema },
    ]),
  ],
  controllers: [LivestockController, FarmerPortalController],
  providers: [AnimalService],
  exports: [AnimalService],
})
export class AnimalModule {}
