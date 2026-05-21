import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Animal, AnimalSchema } from './entities/animal.entity';
import { AnimalService } from './animal.service';
import { AnimalController } from './animal.controller';
import { LivestockController } from './livestock.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Animal.name, schema: AnimalSchema }])],
  controllers: [AnimalController, LivestockController],
  providers: [AnimalService],
  exports: [AnimalService],
})
export class AnimalModule {}
