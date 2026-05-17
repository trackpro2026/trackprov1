import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateTrackingEventDto } from './create-tracking-event.dto';

/** animalId cannot be changed after creation */
export class UpdateTrackingEventDto extends PartialType(
  OmitType(CreateTrackingEventDto, ['animalId'] as const),
) {}
