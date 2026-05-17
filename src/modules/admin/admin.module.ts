import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UserModule } from '../user/user.module';
import { User, UserSchema } from '../user/entities/user.entity';
import { Animal, AnimalSchema } from '../animal/entities/animal.entity';
import { HealthRecord, HealthRecordSchema } from '../health-record/entities/health-record.entity';

@Module({
  imports: [
    UserModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Animal.name, schema: AnimalSchema },
      { name: HealthRecord.name, schema: HealthRecordSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
