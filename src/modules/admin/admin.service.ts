import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserService } from '../user/user.service';
import { Role } from '../../common/decorators/roles.decorator';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { DoctorStatus } from '../user/entities/doctor-profile.schema';
import { User, UserDocument } from '../user/entities/user.entity';
import { Animal, AnimalDocument } from '../animal/entities/animal.entity';
import { HealthRecord, HealthRecordDocument } from '../health-record/entities/health-record.entity';
import {
  Slaughterhouse,
  SlaughterhouseDocument,
} from '../slaughterhouse/entities/slaughterhouse.entity';
import {
  SlaughterRecord,
  SlaughterRecordDocument,
} from '../slaughterhouse/entities/slaughter-record.entity';

@Injectable()
export class AdminService {
  constructor(
    private readonly userService: UserService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Animal.name) private animalModel: Model<AnimalDocument>,
    @InjectModel(HealthRecord.name) private healthRecordModel: Model<HealthRecordDocument>,
    @InjectModel(Slaughterhouse.name)
    private slaughterhouseModel: Model<SlaughterhouseDocument>,
    @InjectModel(SlaughterRecord.name)
    private slaughterRecordModel: Model<SlaughterRecordDocument>,
  ) {}

  listFarmers(pagination: PaginationDto) {
    return this.userService.findAll(pagination, Role.Farmer);
  }

  listDoctors(pagination: PaginationDto) {
    return this.userService.findAll(pagination, Role.Doctor);
  }

  listSlaughterhouseOperators(pagination: PaginationDto) {
    return this.userService.findAll(pagination, Role.Slaughterhouse);
  }

  async listLivestock(pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.animalModel.aggregate([
        { $sort: { updatedAt: -1 } },
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
            from: 'healthrecords',
            let: { aid: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$animalId', '$$aid'] }, type: 'vaccination' } },
              { $sort: { visitDate: -1 } },
              { $limit: 1 },
            ],
            as: 'lastVax',
          },
        },
        {
          $addFields: {
            farmerName: { $arrayElemAt: ['$farmerDoc.name', 0] },
            lastVaccinationDate: { $arrayElemAt: ['$lastVax.visitDate', 0] },
            livestockId: { $toString: '$_id' },
          },
        },
        { $project: { farmerDoc: 0, lastVax: 0 } },
      ]),
      this.animalModel.countDocuments(),
    ]);
    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async listSlaughterhouseFacilities(pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.slaughterhouseModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.slaughterhouseModel.countDocuments(),
    ]);
    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getOverview() {
    const analytics = await this.getAnalytics();
    const [recentVisits, recentLivestock] = await Promise.all([
      this.healthRecordModel.find().sort({ visitDate: -1 }).limit(5).lean(),
      this.animalModel.find().sort({ createdAt: -1 }).limit(5).lean(),
    ]);
    return { ...analytics, recentVisits, recentLivestock };
  }

  getUserById(id: string) {
    return this.userService.findById(id);
  }

  createUser(dto: CreateUserDto, role: Role = Role.Farmer) {
    return this.userService.create(dto, role);
  }

  updateUserByAdmin(id: string, dto: UpdateAdminUserDto) {
    if (dto.userState) {
      return this.userService.updateUserState(id, dto.userState);
    }
    throw new NotFoundException('No valid fields to update');
  }

  updateDoctorStatus(doctorId: string, status: DoctorStatus) {
    return this.userService.updateDoctorStatus(doctorId, status);
  }

  async getAnalytics() {
    const [farmers, doctors, animals, healthRecords, slaughterhouses, slaughterRecords] =
      await Promise.all([
      this.userModel.countDocuments({ role: Role.Farmer }),
      this.userModel.countDocuments({ role: Role.Doctor }),
      this.animalModel.countDocuments(),
      this.healthRecordModel.countDocuments(),
      this.slaughterhouseModel.countDocuments(),
      this.slaughterRecordModel.countDocuments(),
    ]);
    return {
      farmers,
      doctors,
      animals,
      slaughterhouses,
      slaughterRecords,
      healthRecords,
    };
  }
}
