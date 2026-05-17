import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TrackingEvent, TrackingEventDocument } from './entities/tracking-event.entity';
import { CreateTrackingEventDto } from './dto/create-tracking-event.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Animal, AnimalDocument } from '../animal/entities/animal.entity';

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
    if (dto.type === 'weight' && dto.weightKg != null) {
      await this.animalModel.findByIdAndUpdate(animal._id, { weightKg: dto.weightKg });
    }
    return event.save();
  }

  async findForAnimal(animalId: string, farmerId: string, pagination: PaginationDto) {
    const animal = await this.animalModel.findById(animalId).lean().exec();
    if (!animal) throw new NotFoundException('Animal not found');
    if (String(animal.farmerId) !== farmerId) {
      throw new ForbiddenException('You cannot access this animal');
    }
    const { page = 1, limit = 10 } = pagination;
    const filter = { animalId: new Types.ObjectId(animalId) };
    const [items, total] = await Promise.all([
      this.trackingModel.find(filter).sort({ recordedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.trackingModel.countDocuments(filter),
    ]);
    return { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
