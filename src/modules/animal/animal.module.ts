import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Animal, AnimalSchema } from './entities/animal.entity';
import { AnimalService } from './animal.service';
import { LivestockController } from './livestock.controller';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    NotificationModule,
    MongooseModule.forFeature([{ name: Animal.name, schema: AnimalSchema }]),
  ],
  controllers: [LivestockController],
  providers: [AnimalService],
  exports: [AnimalService],
})
export class AnimalModule {}
