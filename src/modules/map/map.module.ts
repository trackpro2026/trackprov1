import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../user/entities/user.entity';
import { Animal, AnimalSchema } from '../animal/entities/animal.entity';
import { Slaughterhouse, SlaughterhouseSchema } from '../slaughterhouse/entities/slaughterhouse.entity';
import { MapService } from './map.service';
import { MapController } from './map.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Animal.name, schema: AnimalSchema },
      { name: Slaughterhouse.name, schema: SlaughterhouseSchema },
    ]),
  ],
  controllers: [MapController],
  providers: [MapService],
})
export class MapModule {}
