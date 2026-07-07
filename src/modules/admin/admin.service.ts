import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { UserService } from '../user/user.service';
import { HealthRecordService } from '../health-record/health-record.service';
import { AnimalService } from '../animal/animal.service';
import { Role } from '../../common/decorators/roles.decorator';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AdminListFarmersQueryDto } from './dto/admin-list-farmers-query.dto';
import { AdminListLivestockQueryDto } from './dto/admin-list-livestock-query.dto';
import { AdminListSlaughterhousesQueryDto } from './dto/admin-list-slaughterhouses-query.dto';
import { AdminListDoctorsQueryDto } from './dto/admin-list-doctors-query.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { DoctorStatus } from '../user/entities/doctor-profile.schema';
import { User, UserDocument } from '../user/entities/user.entity';
import { UserAccountState } from '../user/entities/user-account-state.enum';
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
  SlaughterRecordStatus,
} from '../slaughterhouse/entities/slaughter-record.entity';

@Injectable()
export class AdminService {
  constructor(
    private readonly userService: UserService,
    private readonly healthRecordService: HealthRecordService,
    private readonly animalService: AnimalService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Animal.name) private animalModel: Model<AnimalDocument>,
    @InjectModel(HealthRecord.name) private healthRecordModel: Model<HealthRecordDocument>,
    @InjectModel(Slaughterhouse.name)
    private slaughterhouseModel: Model<SlaughterhouseDocument>,
    @InjectModel(SlaughterRecord.name)
    private slaughterRecordModel: Model<SlaughterRecordDocument>,
  ) {}

  listFarmers(query: AdminListFarmersQueryDto) {
    return this.listUsersWithLivestockCount(Role.Farmer, query);
  }

  async getFarmerStats() {
    const [totalFarmers, activeFarmers, suspendedFarmers, deactivatedFarmers] =
      await Promise.all([
        this.userModel.countDocuments({ role: Role.Farmer }),
        this.userModel.countDocuments({ role: Role.Farmer, userState: UserAccountState.Active }),
        this.userModel.countDocuments({ role: Role.Farmer, userState: UserAccountState.Suspended }),
        this.userModel.countDocuments({
          role: Role.Farmer,
          userState: { $in: [UserAccountState.Blocked, UserAccountState.Pending] },
        }),
      ]);
    return { totalFarmers, activeFarmers, suspendedFarmers, deactivatedFarmers };
  }

  listDoctors(query: AdminListDoctorsQueryDto) {
    return this.listDoctorsEnriched(query);
  }

  async getDoctorStats() {
    return this.getVeterinarianCounts();
  }

  listSlaughterhouseOperators(pagination: PaginationDto) {
    return this.userService.findAll(pagination, Role.Slaughterhouse);
  }

  async listLivestock(query: AdminListLivestockQueryDto) {
    const { page = 1, limit = 10, species, healthStatus, obtainedBy, search } = query;
    const skip = (page - 1) * limit;
    const match: Record<string, unknown> = {};
    if (species) match.species = species;
    if (healthStatus) match.healthStatus = healthStatus;
    if (obtainedBy) match.obtainedBy = obtainedBy;

    const pipeline: PipelineStage[] = [
      { $match: match },
      { $sort: { updatedAt: -1 } },
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
          livestockId: '$tagId',
          type: {
            $let: {
              vars: {
                breedType: '$breedType',
                breed: '$breed',
                species: '$species',
              },
              in: {
                $cond: {
                  if: { $and: ['$$breedType', '$$breed'] },
                  then: { $concat: ['$$breedType', ' (', '$$breed', ')'] },
                  else: {
                    $cond: {
                      if: { $and: ['$$species', '$$breed'] },
                      then: { $concat: ['$$species', ' / ', '$$breed'] },
                      else: { $ifNull: ['$$breedType', { $ifNull: ['$$breed', '$$species'] }] },
                    },
                  },
                },
              },
            },
          },
          gender: '$sex',
        },
      },
    ];

    if (search?.trim()) {
      const regex = search.trim();
      pipeline.push({
        $match: {
          $or: [
            { tagId: { $regex: regex, $options: 'i' } },
            { name: { $regex: regex, $options: 'i' } },
            { farmerName: { $regex: regex, $options: 'i' } },
          ],
        },
      });
    }

    const [items, total] = await Promise.all([
      this.animalModel.aggregate([
        ...pipeline,
        { $skip: skip },
        { $limit: limit },
        { $project: { farmerDoc: 0, lastVisit: 0 } },
      ]),
      search?.trim()
        ? this.animalModel.aggregate([...pipeline, { $count: 'total' }]).then((r) => r[0]?.total ?? 0)
        : this.animalModel.countDocuments(match),
    ]);

    return {
      items: items.map((a) => ({ ...a, id: String(a._id) })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
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
    const detail = await this.animalService.findOneDetailedForSlaughterhouse(id);
    const animal = await this.animalModel.findById(id).lean().exec();
    if (!animal) throw new NotFoundException('Livestock not found');
    const farmer = await this.userModel.findById(animal.farmerId).lean().exec();
    return {
      ...detail,
      owner: farmer
        ? {
            id: String(farmer._id),
            name: farmer.name,
            phone: farmer.phone,
            email: farmer.email,
            farmName: farmer.farmName,
            farmLocation: farmer.farmLocation,
          }
        : null,
    };
  }

  async getSlaughterhouseStats() {
    const [totalSlaughterhouses, totalVisits, totalLivestocks] = await Promise.all([
      this.slaughterhouseModel.countDocuments(),
      this.slaughterRecordModel.countDocuments(),
      this.slaughterRecordModel.countDocuments({ status: SlaughterRecordStatus.Completed }),
    ]);
    return { totalSlaughterhouses, totalVisits, totalLivestocks };
  }

  async listSlaughterhouseFacilities(query: AdminListSlaughterhousesQueryDto) {
    const { page = 1, limit = 10, status, search } = query;
    const skip = (page - 1) * limit;
    const match: Record<string, unknown> = {};
    if (status) match.status = status;

    const pipeline: PipelineStage[] = [
      { $match: match },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'slaughterrecords',
          localField: '_id',
          foreignField: 'slaughterhouseId',
          as: 'records',
        },
      },
      {
        $addFields: {
          numberOfVisits: { $size: '$records' },
          nextScheduledVisit: {
            $min: {
              $map: {
                input: {
                  $filter: {
                    input: '$records',
                    as: 'r',
                    cond: { $eq: ['$$r.status', SlaughterRecordStatus.Scheduled] },
                  },
                },
                as: 's',
                in: '$$s.scheduledDate',
              },
            },
          },
          slaughterhouseId: { $ifNull: ['$facilityCode', { $toString: '$_id' }] },
        },
      },
    ];

    if (search?.trim()) {
      const regex = search.trim();
      pipeline.push({
        $match: {
          $or: [
            { name: { $regex: regex, $options: 'i' } },
            { location: { $regex: regex, $options: 'i' } },
            { facilityCode: { $regex: regex, $options: 'i' } },
            { contactPhone: { $regex: regex, $options: 'i' } },
          ],
        },
      });
    }

    const [items, total, stats] = await Promise.all([
      this.slaughterhouseModel.aggregate([
        ...pipeline,
        { $skip: skip },
        { $limit: limit },
        { $project: { records: 0 } },
      ]),
      search?.trim() || status
        ? this.slaughterhouseModel.aggregate([...pipeline, { $count: 'total' }]).then((r) => r[0]?.total ?? 0)
        : this.slaughterhouseModel.countDocuments(),
      this.getSlaughterhouseStats(),
    ]);

    return {
      summaryCards: stats,
      summary: {
        totalSlaughterhouses: stats.totalSlaughterhouses,
        totalVisits: stats.totalVisits,
        totalLivestocks: stats.totalLivestocks,
        activeSlaughterhouses: await this.slaughterhouseModel.countDocuments({
          status: SlaughterhouseStatus.Approved,
        }),
        inactiveSlaughterhouses: await this.slaughterhouseModel.countDocuments({
          status: { $in: [SlaughterhouseStatus.Pending, SlaughterhouseStatus.Suspended] },
        }),
      },
      items: items.map((f) => ({
        ...f,
        id: String(f._id),
        phoneNumber: f.contactPhone,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getSlaughterhouseDetail(id: string) {
    const facility = await this.slaughterhouseModel.findById(id).lean().exec();
    if (!facility) throw new NotFoundException('Slaughterhouse not found');

    const livestockSlaughteredTable = await this.slaughterRecordModel.aggregate([
      { $match: { slaughterhouseId: new Types.ObjectId(id) } },
      { $sort: { completedDate: -1, scheduledDate: -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: 'animals',
          localField: 'animalId',
          foreignField: '_id',
          as: 'animalDoc',
        },
      },
      {
        $lookup: {
          from: 'healthrecords',
          let: { aid: '$animalId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$animalId', '$$aid'] } } },
            { $sort: { visitDate: -1 } },
            { $limit: 1 },
          ],
          as: 'lastVisit',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'farmerId',
          foreignField: '_id',
          as: 'farmerDoc',
        },
      },
      {
        $addFields: {
          livestockId: { $ifNull: [{ $arrayElemAt: ['$animalDoc.tagId', 0] }, '—'] },
          type: {
            $ifNull: [
              { $arrayElemAt: ['$animalDoc.breed', 0] },
              '$species',
            ],
          },
          registeredBy: { $arrayElemAt: ['$farmerDoc.name', 0] },
          obtainedBy: { $arrayElemAt: ['$animalDoc.obtainedBy', 0] },
          healthStatus: {
            $ifNull: [
              { $arrayElemAt: ['$animalDoc.healthStatus', 0] },
              '$healthStatusLabel',
            ],
          },
          lastVeterinaryVisit: { $arrayElemAt: ['$lastVisit.visitDate', 0] },
        },
      },
      { $project: { animalDoc: 0, lastVisit: 0, farmerDoc: 0 } },
    ]);

    return {
      facility: {
        ...facility,
        id: String(facility._id),
        slaughterhouseId: facility.facilityCode ?? String(facility._id),
        phoneNumber: facility.contactPhone,
        email: facility.ownerId
          ? (
              await this.userModel.findById(facility.ownerId).select('email').lean().exec()
            )?.email
          : undefined,
      },
      livestockSlaughteredTable: livestockSlaughteredTable.map((r) => ({
        ...r,
        id: String(r._id),
        animalId: String(r.animalId),
      })),
      recentSlaughtered: livestockSlaughteredTable,
    };
  }

  async getVisitStats() {
    const [total, completed, pending, totalLivestockChecked, totalVeterinarians] =
      await Promise.all([
        this.healthRecordModel.countDocuments(),
        this.healthRecordModel.countDocuments({ status: VisitStatus.Completed }),
        this.healthRecordModel.countDocuments({ status: VisitStatus.Pending }),
        this.healthRecordModel.distinct('animalId').then((ids) => ids.length),
        this.userModel.countDocuments({ role: Role.Doctor }),
      ]);
    return {
      totalVeterinaryVisits: total,
      totalVisitsCompleted: completed,
      totalVisitsPending: pending,
      totalLivestockChecked,
      totalVeterinarians,
    };
  }

  async getFarmerDetail(farmerId: string) {
    const farmer = await this.userService.findById(farmerId);
    if (farmer.role !== Role.Farmer) {
      throw new NotFoundException('Farmer not found');
    }

    const [livestock, veterinaryVisitCount] = await Promise.all([
      this.animalModel.aggregate([
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
            type: {
              $let: {
                vars: { breedType: '$breedType', breed: '$breed', species: '$species' },
                in: {
                  $cond: {
                    if: { $and: ['$$breedType', '$$breed'] },
                    then: { $concat: ['$$breedType', ' (', '$$breed', ')'] },
                    else: {
                      $cond: {
                        if: { $and: ['$$species', '$$breed'] },
                        then: { $concat: ['$$species', ' / ', '$$breed'] },
                        else: { $ifNull: ['$$breedType', { $ifNull: ['$$breed', '$$species'] }] },
                      },
                    },
                  },
                },
              },
            },
            gender: '$sex',
            lastVeterinaryVisit: { $arrayElemAt: ['$lastVisit.visitDate', 0] },
          },
        },
        { $project: { lastVisit: 0 } },
      ]),
      this.healthRecordModel.countDocuments({ farmerId: new Types.ObjectId(farmerId) }),
    ]);

    return {
      farmer: {
        ...farmer,
        fullName: farmer.name,
        userId: `F${String(farmer.id).slice(-6).toUpperCase()}`,
        profilePictureUrl: farmer.avatarUrl,
        location: farmer.farmLocation ?? farmer.address,
        numberOfLivestock: livestock.length,
        numberOfVeterinaryVisits: veterinaryVisitCount,
      },
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
    const visitCount = await this.healthRecordModel.countDocuments({
      doctorId: new Types.ObjectId(doctorId),
    });
    const vetCounts = await this.getVeterinarianCounts();

    return {
      veterinarian: {
        ...doctor,
        fullName: doctor.name,
        userId: `V${String(doctor.id).slice(-6).toUpperCase()}`,
        profilePictureUrl: doctor.avatarUrl,
        phoneNumber: doctor.phone,
        visitCount,
      },
      summaryCards: vetCounts,
      veterinarianVisits: visits.items,
      veterinaryVisitsTable: visits.items,
      visitsMeta: visits.meta,
    };
  }

  async getOverview() {
    const [
      analytics,
      livestockStats,
      visitStats,
      farmerStats,
      slaughterhouseStats,
      visitsByMonth,
      recentVeterinaryVisits,
      vetCounts,
    ] = await Promise.all([
      this.getAnalytics(),
      this.getLivestockStats(),
      this.getVisitStats(),
      this.getFarmerStats(),
      this.getSlaughterhouseStats(),
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
        ...farmerStats,
        ...livestockStats,
        ...slaughterhouseStats,
        ...visitStats,
      },
      farmerStats,
      livestockStats,
      slaughterhouseStats,
      visitStats,
      veterinarianCounts: vetCounts,
      visitsByMonth,
      veterinaryVisitsTable: recentVeterinaryVisits.items,
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

  private async listUsersWithLivestockCount(role: Role, query: AdminListFarmersQueryDto) {
    const { page = 1, limit = 10, search, userState } = query;
    const skip = (page - 1) * limit;
    const match: Record<string, unknown> = { role };
    if (userState) match.userState = userState;

    const pipeline: PipelineStage[] = [
      { $match: match },
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
          farmerId: { $ifNull: ['$facilityCode', { $toString: '$_id' }] },
          location: { $ifNull: ['$farmLocation', '$address'] },
          phoneNumber: '$phone',
          profilePictureUrl: '$avatarUrl',
        },
      },
    ];

    if (search?.trim()) {
      const regex = search.trim();
      pipeline.push({
        $match: {
          $or: [
            { name: { $regex: regex, $options: 'i' } },
            { email: { $regex: regex, $options: 'i' } },
            { phone: { $regex: regex, $options: 'i' } },
            { farmName: { $regex: regex, $options: 'i' } },
            { farmLocation: { $regex: regex, $options: 'i' } },
          ],
        },
      });
    }

    const [items, total, stats] = await Promise.all([
      this.userModel.aggregate([
        ...pipeline,
        { $project: { animals: 0, passwordHash: 0 } },
        { $skip: skip },
        { $limit: limit },
      ]),
      search?.trim() || userState
        ? this.userModel.aggregate([...pipeline, { $count: 'total' }]).then((r) => r[0]?.total ?? 0)
        : this.userModel.countDocuments(match),
      role === Role.Farmer ? this.getFarmerStats() : Promise.resolve(null),
    ]);

    return {
      ...(stats ? { summaryCards: stats } : {}),
      items: items.map((u) => ({
        ...u,
        id: String(u._id),
        farmerId: `F${String(u._id).slice(-6).toUpperCase()}`,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  private async listDoctorsEnriched(query: AdminListDoctorsQueryDto) {
    const { page = 1, limit = 10, search, status } = query;
    const skip = (page - 1) * limit;
    const match: Record<string, unknown> = { role: Role.Doctor };
    if (status) match['doctorProfile.status'] = status;

    const pipeline: PipelineStage[] = [
      { $match: match },
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
          visitCount: { $size: '$visits' },
          lastVisit: { $max: '$visits.visitDate' },
          lastVisitDateTime: { $max: '$visits.visitDate' },
          status: '$doctorProfile.status',
          phoneNumber: '$phone',
          profilePictureUrl: '$avatarUrl',
          veterinarianName: '$name',
        },
      },
    ];

    if (search?.trim()) {
      const regex = search.trim();
      pipeline.push({
        $match: {
          $or: [
            { name: { $regex: regex, $options: 'i' } },
            { email: { $regex: regex, $options: 'i' } },
            { phone: { $regex: regex, $options: 'i' } },
            { 'doctorProfile.clinicName': { $regex: regex, $options: 'i' } },
          ],
        },
      });
    }

    const [items, total, vetCounts] = await Promise.all([
      this.userModel.aggregate([
        ...pipeline,
        { $project: { visits: 0, passwordHash: 0 } },
        { $skip: skip },
        { $limit: limit },
      ]),
      search?.trim() || status
        ? this.userModel.aggregate([...pipeline, { $count: 'total' }]).then((r) => r[0]?.total ?? 0)
        : this.userModel.countDocuments(match),
      this.getVeterinarianCounts(),
    ]);

    return {
      summaryCards: {
        totalVeterinarians: vetCounts.total,
        activeVeterinarians: vetCounts.active,
        inactiveVeterinarians: vetCounts.inactive,
      },
      summary: vetCounts,
      items: items.map((d) => ({
        ...d,
        id: String(d._id),
        veterinarianId: `V${String(d._id).slice(-6).toUpperCase()}`,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }
}
