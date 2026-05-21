import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Animal, AnimalSchema } from './entities/animal.entity';
import { AnimalService } from './animal.service';
import { LivestockController } from './livestock.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Animal.name, schema: AnimalSchema }])],
  controllers: [LivestockController],
  providers: [AnimalService],
  exports: [AnimalService],
})
export class AnimalModule {}
