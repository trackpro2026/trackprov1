import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  HealthRecord,
  HealthRecordDocument,
  VisitStatus,
} from './entities/health-record.entity';
import { CreateHealthRecordDto } from './dto/create-health-record.dto';
import { UpdateHealthRecordDto } from './dto/update-health-record.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Animal, AnimalDocument } from '../animal/entities/animal.entity';
import { Role } from '../../common/decorators/roles.decorator';

@Injectable()
export class HealthRecordService {
  constructor(
    @InjectModel(HealthRecord.name) private healthRecordModel: Model<HealthRecordDocument>,
    @InjectModel(Animal.name) private animalModel: Model<AnimalDocument>,
  ) {}

  async create(dto: CreateHealthRecordDto, doctorId: string) {
    const animal = await this.animalModel.findById(dto.animalId).exec();
    if (!animal) throw new NotFoundException('Animal not found');
    if (animal.assignedDoctorId && String(animal.assignedDoctorId) !== doctorId) {
      throw new ForbiddenException('This animal is assigned to another veterinarian');
    }
    const record = new this.healthRecordModel({
      animalId: animal._id,
      doctorId: new Types.ObjectId(doctorId),
      farmerId: animal.farmerId,
      visitDate: new Date(dto.visitDate),
      type: dto.type,
      reason: dto.reason ?? dto.type,
      status: dto.status ?? VisitStatus.Pending,
      diagnosis: dto.diagnosis,
      treatment: dto.treatment,
      vaccineName: dto.vaccineName,
      medication: dto.medication,
      notes: dto.notes,
      followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : undefined,
    });
    return record.save();
  }

  async findOne(id: string, userId: string, role: Role) {
    const record = await this.healthRecordModel.findById(id).lean().exec();
    if (!record) throw new NotFoundException('Health record not found');
    if (role === Role.Admin) return record;
    if (role === Role.Farmer && String(record.farmerId) !== userId) {
      throw new ForbiddenException('You cannot access this health record');
    }
    if (role === Role.Doctor && String(record.doctorId) !== userId) {
      throw new ForbiddenException('You can only view records you created');
    }
    return record;
  }

  async findForAnimal(animalId: string, userId: string, role: Role, pagination: PaginationDto) {
    const animal = await this.animalModel.findById(animalId).lean().exec();
    if (!animal) throw new NotFoundException('Animal not found');
    if (role === Role.Admin) {
      return this.paginate({ animalId: new Types.ObjectId(animalId) }, pagination);
    }
    if (role === Role.Farmer && String(animal.farmerId) !== userId) {
      throw new ForbiddenException('You cannot access this animal');
    }
    if (role === Role.Doctor && animal.assignedDoctorId && String(animal.assignedDoctorId) !== userId) {
      throw new ForbiddenException('This animal is not assigned to you');
    }
    return this.paginate({ animalId: new Types.ObjectId(animalId) }, pagination);
  }

  async findForDoctor(doctorId: string, pagination: PaginationDto) {
    return this.paginateEnriched({ doctorId: new Types.ObjectId(doctorId) }, pagination);
  }

  async getDoctorVisitStats(doctorId: string) {
    const did = new Types.ObjectId(doctorId);
    const [totalVisits, pendingVisits, farmerIds, animalIds] = await Promise.all([
      this.healthRecordModel.countDocuments({ doctorId: did }),
      this.healthRecordModel.countDocuments({ doctorId: did, status: VisitStatus.Pending }),
      this.healthRecordModel.distinct('farmerId', { doctorId: did }),
      this.healthRecordModel.distinct('animalId', { doctorId: did }),
    ]);
    const assignedAnimals = await this.animalModel.countDocuments({ assignedDoctorId: did });
    return {
      totalVisits,
      pendingVisits,
      totalFarmers: farmerIds.length,
      totalLivestock: Math.max(animalIds.length, assignedAnimals),
    };
  }

  async findAllEnriched(pagination: PaginationDto) {
    return this.paginateEnriched({}, pagination);
  }

  async update(id: string, dto: UpdateHealthRecordDto, userId: string, role: Role) {
    const record = await this.healthRecordModel.findById(id).exec();
    if (!record) throw new NotFoundException('Health record not found');
    if (role !== Role.Admin && String(record.doctorId) !== userId) {
      throw new ForbiddenException('Only the veterinarian who created this record can update it');
    }
    if (dto.animalId && dto.animalId !== String(record.animalId)) {
      throw new ForbiddenException('Cannot reassign record to another animal');
    }
    if (dto.visitDate) record.visitDate = new Date(dto.visitDate);
    if (dto.followUpDate) record.followUpDate = new Date(dto.followUpDate);
    if (dto.type !== undefined) record.type = dto.type;
    if (dto.reason !== undefined) record.reason = dto.reason;
    if (dto.status !== undefined) record.status = dto.status;
    if (dto.diagnosis !== undefined) record.diagnosis = dto.diagnosis;
    if (dto.treatment !== undefined) record.treatment = dto.treatment;
    if (dto.vaccineName !== undefined) record.vaccineName = dto.vaccineName;
    if (dto.medication !== undefined) record.medication = dto.medication;
    if (dto.notes !== undefined) record.notes = dto.notes;
    return record.save();
  }

  async remove(id: string, userId: string, role: Role) {
    const record = await this.healthRecordModel.findById(id).exec();
    if (!record) throw new NotFoundException('Health record not found');
    if (role !== Role.Admin && String(record.doctorId) !== userId) {
      throw new ForbiddenException('Only the veterinarian who created this record can delete it');
    }
    await this.healthRecordModel.findByIdAndDelete(id).exec();
    return { message: 'Health record removed' };
  }

  private async paginate(filter: Record<string, unknown>, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const [items, total] = await Promise.all([
      this.healthRecordModel
        .find(filter)
        .sort({ visitDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.healthRecordModel.countDocuments(filter),
    ]);
    return { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  private async paginateEnriched(filter: Record<string, unknown>, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.healthRecordModel.aggregate([
        { $match: filter },
        { $sort: { visitDate: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'farmerId',
            foreignField: '_id',
            as: 'farmerDoc',
          },
        },
        {
          $lookup: {
            from: 'animals',
            localField: 'animalId',
            foreignField: '_id',
            as: 'animalDoc',
          },
        },
        {
          $addFields: {
            farmerName: { $arrayElemAt: ['$farmerDoc.name', 0] },
            livestockId: { $toString: { $arrayElemAt: ['$animalDoc._id', 0] } },
            livestockType: { $arrayElemAt: ['$animalDoc.species', 0] },
            animalName: { $arrayElemAt: ['$animalDoc.name', 0] },
            tagId: { $arrayElemAt: ['$animalDoc.tagId', 0] },
          },
        },
        { $project: { farmerDoc: 0, animalDoc: 0 } },
      ]),
      this.healthRecordModel.countDocuments(filter),
    ]);
    return {
      items: items.map((r) => ({ ...r, id: String(r._id) })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
