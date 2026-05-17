import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HealthRecord, HealthRecordDocument } from './entities/health-record.entity';
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
    return this.paginate({ doctorId: new Types.ObjectId(doctorId) }, pagination);
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
}
