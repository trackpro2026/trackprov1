import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrackingEvent, TrackingEventSchema } from './entities/tracking-event.entity';
import { Animal, AnimalSchema } from '../animal/entities/animal.entity';
import { TrackingService } from './tracking.service';
import { TrackingController } from './tracking.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrackingEvent.name, schema: TrackingEventSchema },
      { name: Animal.name, schema: AnimalSchema },
    ]),
  ],
  controllers: [TrackingController],
  providers: [TrackingService],
  exports: [TrackingService],
})
export class TrackingModule {}
