import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UserModule } from '../user/user.module';
import { HealthRecordModule } from '../health-record/health-record.module';
import { AnimalModule } from '../animal/animal.module';
import { User, UserSchema } from '../user/entities/user.entity';
import { Animal, AnimalSchema } from '../animal/entities/animal.entity';
import { HealthRecord, HealthRecordSchema } from '../health-record/entities/health-record.entity';
import { Slaughterhouse, SlaughterhouseSchema } from '../slaughterhouse/entities/slaughterhouse.entity';
import { SlaughterRecord, SlaughterRecordSchema } from '../slaughterhouse/entities/slaughter-record.entity';

@Module({
  imports: [
    UserModule,
    HealthRecordModule,
    AnimalModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Animal.name, schema: AnimalSchema },
      { name: HealthRecord.name, schema: HealthRecordSchema },
      { name: Slaughterhouse.name, schema: SlaughterhouseSchema },
      { name: SlaughterRecord.name, schema: SlaughterRecordSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
