import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HealthRecord, HealthRecordDocument } from './entities/health-record.entity';
import { CreateHealthRecordDto } from './dto/create-health-record.dto';
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
      diagnosis: dto.diagnosis,
      treatment: dto.treatment,
      vaccineName: dto.vaccineName,
      medication: dto.medication,
      notes: dto.notes,
      followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : undefined,
    });
    return record.save();
  }

  async findForAnimal(animalId: string, userId: string, role: Role, pagination: PaginationDto) {
    const animal = await this.animalModel.findById(animalId).lean().exec();
    if (!animal) throw new NotFoundException('Animal not found');
    if (role === Role.Farmer && String(animal.farmerId) !== userId) {
      throw new ForbiddenException('You cannot access this animal');
    }
    if (role === Role.Doctor && animal.assignedDoctorId && String(animal.assignedDoctorId) !== userId) {
      throw new ForbiddenException('This animal is not assigned to you');
    }
    const { page = 1, limit = 10 } = pagination;
    const filter = { animalId: new Types.ObjectId(animalId) };
    const [items, total] = await Promise.all([
      this.healthRecordModel.find(filter).sort({ visitDate: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.healthRecordModel.countDocuments(filter),
    ]);
    return { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findForDoctor(doctorId: string, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const filter = { doctorId: new Types.ObjectId(doctorId) };
    const [items, total] = await Promise.all([
      this.healthRecordModel.find(filter).sort({ visitDate: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.healthRecordModel.countDocuments(filter),
    ]);
    return { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
