import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Slaughterhouse, SlaughterhouseSchema } from './entities/slaughterhouse.entity';
import { SlaughterRecord, SlaughterRecordSchema } from './entities/slaughter-record.entity';
import { Animal, AnimalSchema } from '../animal/entities/animal.entity';
import { User, UserSchema } from '../user/entities/user.entity';
import { SlaughterhouseService } from './slaughterhouse.service';
import {
  SlaughterhouseFacilitiesController,
  SlaughterRecordsController,
} from './slaughterhouse.controller';
import { SlaughterhousePortalController } from './slaughterhouse-portal.controller';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    UserModule,
    MongooseModule.forFeature([
      { name: Slaughterhouse.name, schema: SlaughterhouseSchema },
      { name: SlaughterRecord.name, schema: SlaughterRecordSchema },
      { name: Animal.name, schema: AnimalSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [
    SlaughterhouseFacilitiesController,
    SlaughterRecordsController,
    SlaughterhousePortalController,
  ],
  providers: [SlaughterhouseService],
  exports: [SlaughterhouseService],
})
export class SlaughterhouseModule {}
