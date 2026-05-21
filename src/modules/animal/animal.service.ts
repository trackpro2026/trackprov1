import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Animal, AnimalDocument } from './entities/animal.entity';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { UpdateAnimalDto } from './dto/update-animal.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Role } from '../../common/decorators/roles.decorator';
import { NotificationService } from '../notification/notification.service';
import {
  NotificationRelatedType,
  NotificationType,
} from '../notification/notification.constants';

@Injectable()
export class AnimalService {
  constructor(
    @InjectModel(Animal.name) private animalModel: Model<AnimalDocument>,
    private readonly notificationService: NotificationService,
  ) {}

  async create(dto: CreateAnimalDto, farmerId: string) {
    const existing = await this.animalModel
      .findOne({ farmerId: new Types.ObjectId(farmerId), tagId: dto.tagId })
      .exec();
    if (existing) {
      throw new ConflictException('An animal with this tag ID already exists on your farm');
    }
    const animal = new this.animalModel({
      ...dto,
      farmerId: new Types.ObjectId(farmerId),
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      assignedDoctorId: dto.assignedDoctorId
        ? new Types.ObjectId(dto.assignedDoctorId)
        : undefined,
    });
    const saved = await animal.save();
    if (dto.assignedDoctorId) {
      void this.notificationService.notify(dto.assignedDoctorId, {
        title: 'Livestock assigned to you',
        message: `${saved.name} (${saved.tagId}) was assigned to your care.`,
        type: NotificationType.Livestock,
        relatedId: String(saved._id),
        relatedType: NotificationRelatedType.Animal,
      });
    }
    return saved;
  }

  async findForFarmer(farmerId: string, pagination: PaginationDto) {
    return this.paginate({ farmerId: new Types.ObjectId(farmerId) }, pagination);
  }

  async findForDoctor(doctorId: string, pagination: PaginationDto) {
    return this.paginate({ assignedDoctorId: new Types.ObjectId(doctorId) }, pagination);
  }

  async findAllAdmin(pagination: PaginationDto) {
    return this.paginate({}, pagination);
  }

  async findOne(id: string, userId: string, role: Role) {
    const animal = await this.animalModel.findById(id).lean().exec();
    if (!animal) throw new NotFoundException('Animal not found');
    if (role === Role.Admin) return animal;
    const farmerId = String(animal.farmerId);
    const doctorId = animal.assignedDoctorId ? String(animal.assignedDoctorId) : null;
    if (role === Role.Farmer && farmerId !== userId) {
      throw new ForbiddenException('You cannot access this animal');
    }
    if (role === Role.Doctor && doctorId !== userId) {
      throw new ForbiddenException('This animal is not assigned to you');
    }
    return animal;
  }

  async update(id: string, dto: UpdateAnimalDto, userId: string, role: Role) {
    const before = await this.findOne(id, userId, role);
    const previousDoctorId = before.assignedDoctorId
      ? String(before.assignedDoctorId)
      : undefined;
    const patch: Record<string, unknown> = { ...dto };
    if (dto.dateOfBirth) patch.dateOfBirth = new Date(dto.dateOfBirth);
    if (dto.assignedDoctorId) patch.assignedDoctorId = new Types.ObjectId(dto.assignedDoctorId);
    const updated = await this.animalModel
      .findByIdAndUpdate(id, { $set: patch }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Animal not found');

    const newDoctorId = dto.assignedDoctorId ?? previousDoctorId;
    if (newDoctorId && newDoctorId !== previousDoctorId) {
      void this.notificationService.notify(newDoctorId, {
        title: 'Livestock assigned to you',
        message: `${updated.name} (${updated.tagId}) was assigned to your care.`,
        type: NotificationType.Livestock,
        relatedId: id,
        relatedType: NotificationRelatedType.Animal,
      });
    }

    if (
      dto.healthStatus &&
      dto.healthStatus !== before.healthStatus &&
      updated.assignedDoctorId
    ) {
      void this.notificationService.notify(String(updated.assignedDoctorId), {
        title: 'Livestock health status updated',
        message: `${updated.name} (${updated.tagId}) is now marked ${dto.healthStatus}.`,
        type: NotificationType.Livestock,
        relatedId: id,
        relatedType: NotificationRelatedType.Animal,
      });
    }

    return updated;
  }

  async remove(id: string, userId: string, role: Role) {
    await this.findOne(id, userId, role);
    await this.animalModel.findByIdAndDelete(id).exec();
    return { message: 'Animal removed' };
  }

  async getStatsForFarmer(farmerId: string) {
    const uid = new Types.ObjectId(farmerId);
    const [totals, bySpecies, byHealth] = await Promise.all([
      this.animalModel.countDocuments({ farmerId: uid, status: 'active' }),
      this.animalModel.aggregate([
        { $match: { farmerId: uid } },
        { $group: { _id: '$species', count: { $sum: 1 } } },
      ]),
      this.animalModel.aggregate([
        { $match: { farmerId: uid } },
        { $group: { _id: '$healthStatus', count: { $sum: 1 } } },
      ]),
    ]);
    return {
      totalActive: totals,
      bySpecies: bySpecies.reduce((a, r) => ({ ...a, [r._id]: r.count }), {}),
      byHealthStatus: byHealth.reduce((a, r) => ({ ...a, [r._id]: r.count }), {}),
    };
  }

  private async paginate(filter: Record<string, unknown>, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const [items, total] = await Promise.all([
      this.animalModel
        .find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.animalModel.countDocuments(filter),
    ]);
    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
