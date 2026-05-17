import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TrackingEvent, TrackingEventDocument } from './entities/tracking-event.entity';
import { CreateTrackingEventDto } from './dto/create-tracking-event.dto';
import { UpdateTrackingEventDto } from './dto/update-tracking-event.dto';
import { ListTrackingQueryDto } from './dto/list-tracking-query.dto';
import { Animal, AnimalDocument } from '../animal/entities/animal.entity';
import { TrackingEventType } from './entities/tracking-event.entity';

@Injectable()
export class TrackingService {
  constructor(
    @InjectModel(TrackingEvent.name) private trackingModel: Model<TrackingEventDocument>,
    @InjectModel(Animal.name) private animalModel: Model<AnimalDocument>,
  ) {}

  async create(dto: CreateTrackingEventDto, farmerId: string) {
    const animal = await this.animalModel.findById(dto.animalId).exec();
    if (!animal) throw new NotFoundException('Animal not found');
    if (String(animal.farmerId) !== farmerId) {
      throw new ForbiddenException('You cannot log events for this animal');
    }
    const event = new this.trackingModel({
      animalId: animal._id,
      farmerId: new Types.ObjectId(farmerId),
      recordedAt: new Date(dto.recordedAt),
      type: dto.type,
      weightKg: dto.weightKg,
      location: dto.location,
      notes: dto.notes,
    });
    await event.save();
    if (dto.type === TrackingEventType.Weight && dto.weightKg != null) {
      await this.animalModel.findByIdAndUpdate(animal._id, { weightKg: dto.weightKg });
    }
    return event;
  }

  async findForFarmer(farmerId: string, query: ListTrackingQueryDto) {
    const filter: Record<string, unknown> = { farmerId: new Types.ObjectId(farmerId) };
    if (query.animalId) {
      filter.animalId = new Types.ObjectId(query.animalId);
    }
    return this.paginate(filter, query);
  }

  async findForAnimal(animalId: string, farmerId: string, query: ListTrackingQueryDto) {
    const animal = await this.animalModel.findById(animalId).lean().exec();
    if (!animal) throw new NotFoundException('Animal not found');
    if (String(animal.farmerId) !== farmerId) {
      throw new ForbiddenException('You cannot access this animal');
    }
    return this.paginate({ animalId: new Types.ObjectId(animalId) }, query);
  }

  async findOne(id: string, farmerId: string) {
    const event = await this.trackingModel.findById(id).lean().exec();
    if (!event) throw new NotFoundException('Tracking event not found');
    if (String(event.farmerId) !== farmerId) {
      throw new ForbiddenException('You cannot access this tracking event');
    }
    return event;
  }

  async update(id: string, dto: UpdateTrackingEventDto, farmerId: string) {
    const event = await this.trackingModel.findById(id).exec();
    if (!event) throw new NotFoundException('Tracking event not found');
    if (String(event.farmerId) !== farmerId) {
      throw new ForbiddenException('You cannot update this tracking event');
    }
    if (dto.recordedAt) event.recordedAt = new Date(dto.recordedAt);
    if (dto.type !== undefined) event.type = dto.type;
    if (dto.weightKg !== undefined) event.weightKg = dto.weightKg;
    if (dto.location !== undefined) event.location = dto.location;
    if (dto.notes !== undefined) event.notes = dto.notes;
    await event.save();
    if (event.type === TrackingEventType.Weight && event.weightKg != null) {
      await this.animalModel.findByIdAndUpdate(event.animalId, { weightKg: event.weightKg });
    }
    return event;
  }

  async remove(id: string, farmerId: string) {
    await this.findOne(id, farmerId);
    await this.trackingModel.findByIdAndDelete(id).exec();
    return { message: 'Tracking event removed' };
  }

  private async paginate(filter: Record<string, unknown>, pagination: ListTrackingQueryDto) {
    const { page = 1, limit = 10 } = pagination;
    const [items, total] = await Promise.all([
      this.trackingModel
        .find(filter)
        .sort({ recordedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.trackingModel.countDocuments(filter),
    ]);
    return { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
