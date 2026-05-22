import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserService } from '../user/user.service';
import { HealthRecordService } from '../health-record/health-record.service';
import { Role } from '../../common/decorators/roles.decorator';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { DoctorStatus } from '../user/entities/doctor-profile.schema';
import { User, UserDocument } from '../user/entities/user.entity';
import {
  Animal,
  AnimalDocument,
  AnimalHealthStatus,
} from '../animal/entities/animal.entity';
import {
  HealthRecord,
  HealthRecordDocument,
  VisitStatus,
} from '../health-record/entities/health-record.entity';
import {
  Slaughterhouse,
  SlaughterhouseDocument,
  SlaughterhouseStatus,
} from '../slaughterhouse/entities/slaughterhouse.entity';
import {
  SlaughterRecord,
  SlaughterRecordDocument,
} from '../slaughterhouse/entities/slaughter-record.entity';

@Injectable()
export class AdminService {
  constructor(
    private readonly userService: UserService,
    private readonly healthRecordService: HealthRecordService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Animal.name) private animalModel: Model<AnimalDocument>,
    @InjectModel(HealthRecord.name) private healthRecordModel: Model<HealthRecordDocument>,
    @InjectModel(Slaughterhouse.name)
    private slaughterhouseModel: Model<SlaughterhouseDocument>,
    @InjectModel(SlaughterRecord.name)
    private slaughterRecordModel: Model<SlaughterRecordDocument>,
  ) {}

  listFarmers(pagination: PaginationDto) {
    return this.listUsersWithLivestockCount(Role.Farmer, pagination);
  }

  listDoctors(pagination: PaginationDto) {
    return this.listDoctorsEnriched(pagination);
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
              { $match: { $expr: { $eq: ['$animalId', '$$aid'] } } },
              { $sort: { visitDate: -1 } },
              { $limit: 1 },
            ],
            as: 'lastVisit',
          },
        },
        {
          $addFields: {
            farmerName: { $arrayElemAt: ['$farmerDoc.name', 0] },
            ownerId: { $toString: '$farmerId' },
            lastVeterinaryVisit: { $arrayElemAt: ['$lastVisit.visitDate', 0] },
            lastVaccinationDate: { $arrayElemAt: ['$lastVisit.visitDate', 0] },
            livestockId: '$tagId',
          },
        },
        { $project: { farmerDoc: 0, lastVisit: 0 } },
      ]),
      this.animalModel.countDocuments(),
    ]);
    return {
      items: items.map((a) => ({ ...a, id: String(a._id) })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getLivestockStats() {
    const [total, healthy, sick] = await Promise.all([
      this.animalModel.countDocuments(),
      this.animalModel.countDocuments({ healthStatus: AnimalHealthStatus.Healthy }),
      this.animalModel.countDocuments({
        healthStatus: { $in: [AnimalHealthStatus.Sick, AnimalHealthStatus.UnderTreatment] },
      }),
    ]);
    return { totalLivestock: total, healthyLivestock: healthy, sickLivestock: sick };
  }

  async getLivestockDetail(id: string) {
    const animal = await this.animalModel.findById(id).lean().exec();
    if (!animal) throw new NotFoundException('Livestock not found');

    const [farmer, visits, visitTypeBreakdown] = await Promise.all([
      this.userModel.findById(animal.farmerId).lean().exec(),
      this.healthRecordModel.find({ animalId: id }).sort({ visitDate: -1 }).limit(20).lean(),
      this.healthRecordModel.aggregate([
        { $match: { animalId: new Types.ObjectId(id) } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
    ]);

    return {
      livestock: { ...animal, id: String(animal._id) },
      owner: farmer
        ? {
            id: String(farmer._id),
            name: farmer.name,
            phone: farmer.phone,
            email: farmer.email,
            address: farmer.address,
            farmName: farmer.farmName,
          }
        : null,
      veterinaryVisits: visits.map((v) => ({
        ...v,
        id: String(v._id),
        summary: v.reason ?? v.type,
      })),
      visitTypeChart: visitTypeBreakdown.map((r) => ({ type: r._id, count: r.count })),
    };
  }

  async listSlaughterhouseFacilities(pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;
    const [items, total, activeCount, inactiveCount] = await Promise.all([
      this.slaughterhouseModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.slaughterhouseModel.countDocuments(),
      this.slaughterhouseModel.countDocuments({ status: SlaughterhouseStatus.Approved }),
      this.slaughterhouseModel.countDocuments({
        status: { $in: [SlaughterhouseStatus.Pending, SlaughterhouseStatus.Suspended] },
      }),
    ]);
    return {
      summary: {
        totalSlaughterhouses: total,
        activeSlaughterhouses: activeCount,
        inactiveSlaughterhouses: inactiveCount,
      },
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getSlaughterhouseDetail(id: string) {
    const facility = await this.slaughterhouseModel.findById(id).lean().exec();
    if (!facility) throw new NotFoundException('Slaughterhouse not found');

    const recentSlaughtered = await this.slaughterRecordModel
      .find({ slaughterhouseId: id })
      .sort({ scheduledDate: -1 })
      .limit(20)
      .lean();

    return {
      facility: { ...facility, id: String(facility._id) },
      recentSlaughtered: recentSlaughtered.map((r) => ({
        ...r,
        id: String(r._id),
        livestockId: r.animalName,
      })),
    };
  }

  async getVisitStats() {
    const [total, completed, pending] = await Promise.all([
      this.healthRecordModel.countDocuments(),
      this.healthRecordModel.countDocuments({ status: VisitStatus.Completed }),
      this.healthRecordModel.countDocuments({ status: VisitStatus.Pending }),
    ]);
    return {
      totalVeterinaryVisits: total,
      totalVisitsCompleted: completed,
      totalVisitsPending: pending,
    };
  }

  async getFarmerDetail(farmerId: string) {
    const farmer = await this.userService.findById(farmerId);
    if (farmer.role !== Role.Farmer) {
      throw new NotFoundException('Farmer not found');
    }

    const livestock = await this.animalModel.aggregate([
      { $match: { farmerId: new Types.ObjectId(farmerId) } },
      { $sort: { updatedAt: -1 } },
      {
        $lookup: {
          from: 'healthrecords',
          let: { aid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$animalId', '$$aid'] } } },
            { $sort: { visitDate: -1 } },
            { $limit: 1 },
          ],
          as: 'lastVisit',
        },
      },
      {
        $addFields: {
          livestockId: '$tagId',
          lastVeterinaryVisit: { $arrayElemAt: ['$lastVisit.visitDate', 0] },
        },
      },
      { $project: { lastVisit: 0 } },
    ]);

    return {
      farmer,
      livestockCount: livestock.length,
      livestockTable: livestock.map((a) => ({ ...a, id: String(a._id) })),
    };
  }

  async getDoctorDetail(doctorId: string) {
    const doctor = await this.userService.findById(doctorId);
    if (doctor.role !== Role.Doctor) {
      throw new NotFoundException('Veterinarian not found');
    }

    const visits = await this.healthRecordService.findForDoctor(doctorId, { page: 1, limit: 20 });
    const [active, inactive] = await Promise.all([
      this.userModel.countDocuments({
        role: Role.Doctor,
        'doctorProfile.status': { $in: [DoctorStatus.Approved, DoctorStatus.Active] },
      }),
      this.userModel.countDocuments({
        role: Role.Doctor,
        'doctorProfile.status': { $in: [DoctorStatus.Inactive, DoctorStatus.Declined] },
      }),
    ]);

    return {
      veterinarian: doctor,
      veterinarianVisits: visits.items,
      visitsMeta: visits.meta,
      platformVetCounts: { active, inactive },
    };
  }

  async getOverview() {
    const [
      analytics,
      livestockStats,
      visitStats,
      visitsByMonth,
      recentVeterinaryVisits,
      vetCounts,
    ] = await Promise.all([
      this.getAnalytics(),
      this.getLivestockStats(),
      this.getVisitStats(),
      this.getVisitsByMonth(12),
      this.healthRecordService.findAllEnriched({ page: 1, limit: 10 }),
      this.getVeterinarianCounts(),
    ]);

    return {
      summaryCards: {
        farmers: analytics.farmers,
        livestock: analytics.animals,
        slaughterhouses: analytics.slaughterhouses,
        veterinarians: analytics.doctors,
      },
      ...livestockStats,
      ...visitStats,
      veterinarianCounts: vetCounts,
      visitsByMonth,
      recentVeterinaryVisits: recentVeterinaryVisits.items,
      veterinaryVisitsMeta: recentVeterinaryVisits.meta,
      analytics,
    };
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

  private async getVeterinarianCounts() {
    const [total, active, inactive, pendingReview] = await Promise.all([
      this.userModel.countDocuments({ role: Role.Doctor }),
      this.userModel.countDocuments({
        role: Role.Doctor,
        'doctorProfile.status': { $in: [DoctorStatus.Approved, DoctorStatus.Active] },
      }),
      this.userModel.countDocuments({
        role: Role.Doctor,
        'doctorProfile.status': { $in: [DoctorStatus.Inactive, DoctorStatus.Declined] },
      }),
      this.userModel.countDocuments({
        role: Role.Doctor,
        'doctorProfile.status': DoctorStatus.PendingReview,
      }),
    ]);
    return { total, active, inactive, pendingReview };
  }

  private async getVisitsByMonth(months: number) {
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const rows = await this.healthRecordModel.aggregate([
      { $match: { visitDate: { $gte: since } } },
      {
        $group: {
          _id: { year: { $year: '$visitDate' }, month: { $month: '$visitDate' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    return rows.map((r) => ({
      year: r._id.year,
      month: r._id.month,
      label: `${r._id.year}-${String(r._id.month).padStart(2, '0')}`,
      count: r.count,
    }));
  }

  private async listUsersWithLivestockCount(role: Role, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.userModel.aggregate([
        { $match: { role } },
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: 'animals',
            localField: '_id',
            foreignField: 'farmerId',
            as: 'animals',
          },
        },
        {
          $addFields: {
            livestockCount: { $size: '$animals' },
            farmerId: { $toString: '$_id' },
          },
        },
        { $project: { animals: 0, passwordHash: 0 } },
        { $skip: skip },
        { $limit: limit },
      ]),
      this.userModel.countDocuments({ role }),
    ]);
    return {
      items: items.map((u) => ({ ...u, id: String(u._id) })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  private async listDoctorsEnriched(pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;
    const [items, total, vetCounts] = await Promise.all([
      this.userModel.aggregate([
        { $match: { role: Role.Doctor } },
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: 'healthrecords',
            localField: '_id',
            foreignField: 'doctorId',
            as: 'visits',
          },
        },
        {
          $addFields: {
            lastVisit: {
              $max: '$visits.visitDate',
            },
            status: '$doctorProfile.status',
            phoneNumber: '$phone',
          },
        },
        { $project: { visits: 0, passwordHash: 0 } },
        { $skip: skip },
        { $limit: limit },
      ]),
      this.userModel.countDocuments({ role: Role.Doctor }),
      this.getVeterinarianCounts(),
    ]);
    return {
      summary: vetCounts,
      items: items.map((d) => ({ ...d, id: String(d._id) })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
