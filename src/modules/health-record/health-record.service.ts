import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import {
  HealthRecord,
  HealthRecordDocument,
  HealthRecordType,
  VisitStatus,
} from './entities/health-record.entity';
import { User, UserDocument } from '../user/entities/user.entity';
import {
  SlaughterRecord,
  SlaughterRecordDocument,
} from '../slaughterhouse/entities/slaughter-record.entity';
import { AnimalHealthStatus } from '../animal/entities/animal.entity';
import { DoctorOverviewQueryDto } from './dto/doctor-overview-query.dto';
import { CreateHealthRecordDto } from './dto/create-health-record.dto';
import { UpdateHealthRecordDto } from './dto/update-health-record.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Animal, AnimalDocument } from '../animal/entities/animal.entity';
import { Role } from '../../common/decorators/roles.decorator';
import { NotificationService } from '../notification/notification.service';
import {
  NotificationRelatedType,
  NotificationType,
} from '../notification/notification.constants';

@Injectable()
export class HealthRecordService {
  constructor(
    @InjectModel(HealthRecord.name) private healthRecordModel: Model<HealthRecordDocument>,
    @InjectModel(Animal.name) private animalModel: Model<AnimalDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(SlaughterRecord.name)
    private slaughterRecordModel: Model<SlaughterRecordDocument>,
    private readonly notificationService: NotificationService,
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
    const saved = await record.save();
    const visitId = String(saved._id);
    const reason = saved.reason ?? saved.type;
    void this.notificationService.notify(String(animal.farmerId), {
      title: 'Veterinary visit logged',
      message: `A ${saved.type} visit was scheduled for ${animal.name} (${animal.tagId}): ${reason}.`,
      type: NotificationType.VeterinaryVisit,
      relatedId: visitId,
      relatedType: NotificationRelatedType.HealthRecord,
    });
    return saved;
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

  /** Figma visit detail: livestock card, owner card, veterinarian summary */
  async findOneDetailed(id: string, userId: string, role: Role) {
    const record = await this.findOne(id, userId, role);
    const [animal, farmer, doctor] = await Promise.all([
      this.animalModel.findById(record.animalId).lean().exec(),
      this.userModel.findById(record.farmerId).lean().exec(),
      this.userModel.findById(record.doctorId).select('name avatarUrl doctorProfile').lean().exec(),
    ]);

    return {
      ...record,
      id: String(record._id),
      summary: record.reason ?? record.type,
      visitDateTime: record.visitDate,
      livestock: animal
        ? {
            id: String(animal._id),
            tagId: animal.tagId,
            name: animal.name,
            species: animal.species,
            breed: animal.breed,
            sex: animal.sex,
            weightKg: animal.weightKg,
            healthStatus: animal.healthStatus,
            imageUrls: animal.imageUrls,
            ageYears: this.ageYearsFromBirth(animal.dateOfBirth),
          }
        : null,
      owner: farmer
        ? {
            id: String(farmer._id),
            name: farmer.name,
            phone: farmer.phone,
            address: farmer.address,
            farmName: farmer.farmName,
            farmLocation: farmer.farmLocation,
            avatarUrl: farmer.avatarUrl,
          }
        : null,
      veterinarian: doctor
        ? {
            id: String(doctor._id),
            name: doctor.name,
            avatarUrl: doctor.avatarUrl,
            clinicName: doctor.doctorProfile?.clinicName,
            licenseNumber: doctor.doctorProfile?.licenseNumber,
          }
        : null,
    };
  }

  async getDoctorOverview(doctorId: string, period?: DoctorOverviewQueryDto) {
    const did = new Types.ObjectId(doctorId);
    const { start, end, month, year } = this.resolvePeriod(period);
    const visitDateFilter = { $gte: start, $lte: end };
    const visitFilter = { doctorId: did, visitDate: visitDateFilter };

    const [
      totalVisits,
      pendingVisits,
      farmerIds,
      slaughterhousesVisited,
      healthyAnimals,
      sickAnimals,
      recentVisits,
      visitTypeBreakdown,
    ] = await Promise.all([
      this.healthRecordModel.countDocuments(visitFilter),
      this.healthRecordModel.countDocuments({ ...visitFilter, status: VisitStatus.Pending }),
      this.healthRecordModel.distinct('farmerId', { doctorId: did }),
      this.slaughterRecordModel.distinct('slaughterhouseId', { inspectorDoctorId: did }),
      this.animalModel.countDocuments({
        assignedDoctorId: did,
        healthStatus: AnimalHealthStatus.Healthy,
      }),
      this.animalModel.countDocuments({
        assignedDoctorId: did,
        healthStatus: { $in: [AnimalHealthStatus.Sick, AnimalHealthStatus.UnderTreatment] },
      }),
      this.findForDoctor(doctorId, { page: 1, limit: 10 }),
      this.healthRecordModel.aggregate([
        { $match: visitFilter },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
    ]);

    const assignedAnimals = await this.animalModel.countDocuments({ assignedDoctorId: did });

    return {
      period: { month, year, start, end },
      totalVisits,
      pendingVisits,
      totalFarmers: farmerIds.length,
      totalLivestock: assignedAnimals,
      slaughterhousesVisited: slaughterhousesVisited.length,
      healthyAnimals,
      sickAnimals,
      visitTypeBreakdown: visitTypeBreakdown.reduce(
        (acc, row) => ({ ...acc, [row._id]: row.count }),
        {} as Record<string, number>,
      ),
      recentVeterinaryVisits: recentVisits.items,
      veterinaryVisitsMeta: recentVisits.meta,
    };
  }

  async getDoctorAnalytics(doctorId: string, months = 6) {
    const did = new Types.ObjectId(doctorId);
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const [visitTypeBreakdown, visitsByMonth, totalAllTime] = await Promise.all([
      this.healthRecordModel.aggregate([
        { $match: { doctorId: did } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.healthRecordModel.aggregate([
        { $match: { doctorId: did, visitDate: { $gte: since } } },
        {
          $group: {
            _id: {
              year: { $year: '$visitDate' },
              month: { $month: '$visitDate' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      this.healthRecordModel.countDocuments({ doctorId: did }),
    ]);

    return {
      totalVisitsAllTime: totalAllTime,
      visitTypeChart: visitTypeBreakdown.map((r) => ({
        type: r._id as HealthRecordType,
        count: r.count,
      })),
      visitsByMonth: visitsByMonth.map((r) => ({
        year: r._id.year,
        month: r._id.month,
        label: `${r._id.year}-${String(r._id.month).padStart(2, '0')}`,
        count: r.count,
      })),
    };
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

  async findForDoctor(doctorId: string, pagination: PaginationDto, search?: string) {
    const filter: Record<string, unknown> = { doctorId: new Types.ObjectId(doctorId) };
    if (search?.trim()) {
      const regex = { $regex: search.trim(), $options: 'i' };
      filter.$or = [{ reason: regex }, { type: regex }, { diagnosis: regex }];
    }
    return this.paginateEnriched(filter, pagination, search?.trim());
  }

  async getDoctorVisitStats(doctorId: string) {
    const overview = await this.getDoctorOverview(doctorId);
    return {
      totalVisits: overview.totalVisits,
      pendingVisits: overview.pendingVisits,
      totalFarmers: overview.totalFarmers,
      totalLivestock: overview.totalLivestock,
      slaughterhousesVisited: overview.slaughterhousesVisited,
      healthyAnimals: overview.healthyAnimals,
      sickAnimals: overview.sickAnimals,
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
    const previousStatus = record.status;
    const saved = await record.save();
    if (dto.status !== undefined && dto.status !== previousStatus) {
      await this.notifyVisitStatusChange(saved, previousStatus);
    }
    return saved;
  }

  async remove(id: string, userId: string, role: Role) {
    const record = await this.healthRecordModel.findById(id).exec();
    if (!record) throw new NotFoundException('Health record not found');
    if (role !== Role.Admin && String(record.doctorId) !== userId) {
      throw new ForbiddenException('Only the veterinarian who created this record can delete it');
    }
    const animal = await this.animalModel.findById(record.animalId).lean().exec();
    await this.healthRecordModel.findByIdAndDelete(id).exec();
    if (animal) {
      void this.notificationService.notify(String(record.farmerId), {
        title: 'Veterinary visit removed',
        message: `A visit for ${animal.name} (${animal.tagId}) was removed from your records.`,
        type: NotificationType.VeterinaryVisit,
        relatedId: id,
        relatedType: NotificationRelatedType.HealthRecord,
      });
    }
    return { message: 'Health record removed' };
  }

  private async notifyVisitStatusChange(
    record: HealthRecordDocument,
    previousStatus: VisitStatus,
  ) {
    if (record.status !== VisitStatus.Completed || previousStatus === VisitStatus.Completed) {
      return;
    }
    const animal = await this.animalModel.findById(record.animalId).lean().exec();
    const label = animal ? `${animal.name} (${animal.tagId})` : 'your livestock';
    void this.notificationService.notify(String(record.farmerId), {
      title: 'Veterinary visit completed',
      message: `The visit for ${label} has been marked completed.`,
      type: NotificationType.VeterinaryVisit,
      relatedId: String(record._id),
      relatedType: NotificationRelatedType.HealthRecord,
    });
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

  private resolvePeriod(period?: DoctorOverviewQueryDto) {
    const now = new Date();
    const month = period?.month ?? now.getMonth() + 1;
    const year = period?.year ?? now.getFullYear();
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end, month, year };
  }

  private ageYearsFromBirth(dateOfBirth?: Date) {
    if (!dateOfBirth) return undefined;
    const ms = Date.now() - new Date(dateOfBirth).getTime();
    return Math.max(0, Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000)));
  }

  private async paginateEnriched(
    filter: Record<string, unknown>,
    pagination: PaginationDto,
    search?: string,
  ) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;
    const pipeline: PipelineStage[] = [
      { $match: filter },
      { $sort: { visitDate: -1 } },
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
          ownerName: { $arrayElemAt: ['$farmerDoc.name', 0] },
          farmerId: { $toString: '$farmerId' },
          visitId: { $toString: '$_id' },
          livestockId: { $arrayElemAt: ['$animalDoc.tagId', 0] },
          livestockTagId: { $arrayElemAt: ['$animalDoc.tagId', 0] },
          livestockType: { $arrayElemAt: ['$animalDoc.species', 0] },
          animalName: { $arrayElemAt: ['$animalDoc.name', 0] },
          tagId: { $arrayElemAt: ['$animalDoc.tagId', 0] },
          summary: { $ifNull: ['$reason', '$type'] },
          visitDateTime: '$visitDate',
        },
      },
    ];

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { farmerName: { $regex: search, $options: 'i' } },
            { tagId: { $regex: search, $options: 'i' } },
            { summary: { $regex: search, $options: 'i' } },
            { livestockId: { $regex: search, $options: 'i' } },
          ],
        },
      });
    }

    const [items, total] = await Promise.all([
      this.healthRecordModel.aggregate([
        ...pipeline,
        { $skip: skip },
        { $limit: limit },
        { $project: { farmerDoc: 0, animalDoc: 0 } },
      ]),
      search
        ? this.healthRecordModel
            .aggregate([...pipeline, { $count: 'total' }])
            .then((r) => r[0]?.total ?? 0)
        : this.healthRecordModel.countDocuments(filter),
    ]);
    return {
      items: items.map((r) => ({ ...r, id: String(r._id) })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
