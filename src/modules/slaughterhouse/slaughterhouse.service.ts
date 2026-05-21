import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Slaughterhouse,
  SlaughterhouseDocument,
  SlaughterhouseStatus,
} from './entities/slaughterhouse.entity';
import {
  SlaughterRecord,
  SlaughterRecordDocument,
  SlaughterRecordStatus,
} from './entities/slaughter-record.entity';
import {
  CreateSlaughterhouseDto,
  CreateSlaughterRecordDto,
  UpdateSlaughterhouseDto,
  UpdateSlaughterRecordDto,
} from './dto/slaughterhouse.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Animal, AnimalDocument } from '../animal/entities/animal.entity';
import { Role } from '../../common/decorators/roles.decorator';
import { SlaughterhouseOperatorStatus } from '../user/entities/slaughterhouse-profile.schema';
import { CompleteSlaughterhouseProfileDto } from '../user/dto/complete-slaughterhouse-profile.dto';
import { User, UserDocument } from '../user/entities/user.entity';

@Injectable()
export class SlaughterhouseService {
  constructor(
    @InjectModel(Slaughterhouse.name)
    private facilityModel: Model<SlaughterhouseDocument>,
    @InjectModel(SlaughterRecord.name)
    private recordModel: Model<SlaughterRecordDocument>,
    @InjectModel(Animal.name) private animalModel: Model<AnimalDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async linkFacilityForOperator(operatorId: string, dto: CompleteSlaughterhouseProfileDto) {
    const operator = await this.userModel.findById(operatorId).exec();
    if (!operator) throw new NotFoundException('Operator not found');

    const existingId = operator.slaughterhouseProfile?.facilityId;
    if (existingId) {
      const facility = await this.facilityModel.findById(existingId).exec();
      if (facility) return facility;
    }

    const count = await this.facilityModel.countDocuments();
    const facilityCode = `SH-${String(count + 1).padStart(3, '0')}`;
    const facility = await this.facilityModel.create({
      facilityCode,
      ownerId: operatorId,
      ownerName: operator.name,
      name: dto.facilityName,
      location: dto.location,
      state: dto.state,
      licenseNumber: dto.licenseNumber,
      contactPhone: dto.contactPhone ?? operator.phone,
      status: SlaughterhouseStatus.Approved,
    });

    const prev = operator.slaughterhouseProfile;
    operator.slaughterhouseProfile = {
      facilityName: prev?.facilityName ?? dto.facilityName,
      location: prev?.location ?? dto.location,
      state: prev?.state ?? dto.state,
      licenseNumber: prev?.licenseNumber ?? dto.licenseNumber,
      contactPhone: prev?.contactPhone ?? dto.contactPhone,
      documentUrls: prev?.documentUrls ?? [],
      profileImageUrl: prev?.profileImageUrl,
      status: prev?.status ?? SlaughterhouseOperatorStatus.PendingReview,
      facilityId: String(facility._id),
    };
    await operator.save();
    return facility;
  }

  async createFacility(dto: CreateSlaughterhouseDto) {
    const facility = new this.facilityModel({
      ...dto,
      status: SlaughterhouseStatus.Approved,
    });
    return facility.save();
  }

  async getOperatorOverview(operatorId: string) {
    const facility = await this.facilityModel.findOne({ ownerId: operatorId }).lean().exec();

    const [recentSlaughtered, cattleCount, goatCount] = await Promise.all([
      this.recordModel
        .find(facility ? { slaughterhouseId: facility._id } : {})
        .sort({ scheduledDate: -1 })
        .limit(10)
        .lean(),
      this.recordModel.countDocuments(
        facility ? { slaughterhouseId: facility._id, species: 'cattle' } : {},
      ),
      this.recordModel.countDocuments(
        facility ? { slaughterhouseId: facility._id, species: 'goat' } : {},
      ),
    ]);

    return {
      facility,
      totalCattle: cattleCount,
      totalGoat: goatCount,
      recentSlaughtered,
    };
  }

  async listFacilities(all: boolean) {
    const filter = all ? {} : { status: SlaughterhouseStatus.Approved };
    return this.facilityModel.find(filter).sort({ name: 1 }).lean().exec();
  }

  async getFacility(id: string) {
    const facility = await this.facilityModel.findById(id).lean().exec();
    if (!facility) throw new NotFoundException('Slaughterhouse not found');
    return facility;
  }

  async updateFacility(id: string, dto: UpdateSlaughterhouseDto) {
    const updated = await this.facilityModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Slaughterhouse not found');
    return updated;
  }

  async createRecord(dto: CreateSlaughterRecordDto, farmerId: string) {
    const animal = await this.animalModel.findById(dto.animalId).exec();
    if (!animal) throw new NotFoundException('Animal not found');
    if (String(animal.farmerId) !== farmerId) {
      throw new ForbiddenException('You can only schedule slaughter for your own animals');
    }

    const facility = await this.facilityModel.findById(dto.slaughterhouseId).exec();
    if (!facility) throw new NotFoundException('Slaughterhouse not found');
    if (facility.status !== SlaughterhouseStatus.Approved) {
      throw new BadRequestException('Slaughterhouse is not approved for use');
    }

    const record = new this.recordModel({
      animalId: animal._id,
      farmerId: new Types.ObjectId(farmerId),
      slaughterhouseId: facility._id,
      animalName: animal.name,
      species: animal.species,
      healthStatusLabel: animal.healthStatus,
      scheduledDate: new Date(dto.scheduledDate),
      liveWeightKg: dto.liveWeightKg,
      anteMortemNotes: dto.anteMortemNotes,
    });
    return record.save();
  }

  async findRecords(userId: string, role: Role, pagination: PaginationDto) {
    const filter =
      role === Role.Farmer
        ? { farmerId: new Types.ObjectId(userId) }
        : {};

    return this.paginateRecords(filter, pagination);
  }

  async findOneRecord(id: string, userId: string, role: Role) {
    const record = await this.recordModel.findById(id).lean().exec();
    if (!record) throw new NotFoundException('Slaughter record not found');
    if (role === Role.Admin) return record;
    if (role === Role.Farmer && String(record.farmerId) !== userId) {
      throw new ForbiddenException('You cannot access this slaughter record');
    }
    return record;
  }

  async updateRecord(
    id: string,
    dto: UpdateSlaughterRecordDto,
    userId: string,
    role: Role,
  ) {
    const record = await this.recordModel.findById(id).exec();
    if (!record) throw new NotFoundException('Slaughter record not found');

    if (role === Role.Farmer) {
      if (String(record.farmerId) !== userId) {
        throw new ForbiddenException('You cannot update this slaughter record');
      }
      if (dto.status && dto.status !== SlaughterRecordStatus.Cancelled) {
        throw new ForbiddenException('Farmers can only cancel scheduled records');
      }
    }

    if (role === Role.Doctor) {
      record.inspectorDoctorId = new Types.ObjectId(userId);
    }

    if (dto.scheduledDate) record.scheduledDate = new Date(dto.scheduledDate);
    if (dto.completedDate) record.completedDate = new Date(dto.completedDate);
    if (dto.liveWeightKg !== undefined) record.liveWeightKg = dto.liveWeightKg;
    if (dto.carcassWeightKg !== undefined) record.carcassWeightKg = dto.carcassWeightKg;
    if (dto.inspectionStatus) record.inspectionStatus = dto.inspectionStatus;
    if (dto.status) record.status = dto.status;
    if (dto.certificateNumber) record.certificateNumber = dto.certificateNumber;
    if (dto.anteMortemNotes !== undefined) record.anteMortemNotes = dto.anteMortemNotes;
    if (dto.postMortemNotes !== undefined) record.postMortemNotes = dto.postMortemNotes;
    if (dto.imageUrls) record.imageUrls = dto.imageUrls;

    if (
      dto.status === SlaughterRecordStatus.Completed &&
      !record.completedDate
    ) {
      record.completedDate = new Date();
    }

    return record.save();
  }

  async removeRecord(id: string, userId: string, role: Role) {
    const record = await this.recordModel.findById(id).exec();
    if (!record) throw new NotFoundException('Slaughter record not found');

    if (role === Role.Farmer) {
      if (String(record.farmerId) !== userId) {
        throw new ForbiddenException('You cannot delete this slaughter record');
      }
      if (record.status !== SlaughterRecordStatus.Scheduled) {
        throw new BadRequestException('Only scheduled records can be cancelled by farmers');
      }
    }

    await this.recordModel.findByIdAndDelete(id).exec();
    return { message: 'Slaughter record removed' };
  }

  private async paginateRecords(filter: Record<string, unknown>, pagination: PaginationDto) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.recordModel
        .find(filter)
        .sort({ scheduledDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.recordModel.countDocuments(filter).exec(),
    ]);
    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
