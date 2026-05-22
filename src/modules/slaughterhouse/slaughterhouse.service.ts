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
  SlaughterInspectionStatus,
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
import { NotificationService } from '../notification/notification.service';
import {
  NotificationRelatedType,
  NotificationType,
} from '../notification/notification.constants';
@Injectable()
export class SlaughterhouseService {
  constructor(
    @InjectModel(Slaughterhouse.name)
    private facilityModel: Model<SlaughterhouseDocument>,
    @InjectModel(SlaughterRecord.name)
    private recordModel: Model<SlaughterRecordDocument>,
    @InjectModel(Animal.name) private animalModel: Model<AnimalDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly notificationService: NotificationService,
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

  async getFacilityByOperator(operatorId: string) {
    return this.facilityModel.findOne({ ownerId: operatorId }).exec();
  }

  async getOperatorOverview(operatorId: string) {
    const facility = await this.getFacilityByOperator(operatorId);
    if (!facility) {
      return {
        facility: null,
        totalCattle: 0,
        totalGoat: 0,
        pendingInspections: 0,
        scheduledToday: 0,
        processAlerts: [],
        recentSlaughtered: [],
        animalsRegisteredTable: [],
      };
    }

    const facilityId = facility._id;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const baseFilter = { slaughterhouseId: facilityId };

    const [
      recentSlaughtered,
      cattleCount,
      goatCount,
      pendingInspections,
      scheduledToday,
      animalsRegisteredTable,
    ] = await Promise.all([
      this.recordModel
        .find(baseFilter)
        .sort({ scheduledDate: -1 })
        .limit(10)
        .lean(),
      this.recordModel.countDocuments({ ...baseFilter, species: 'cattle' }),
      this.recordModel.countDocuments({ ...baseFilter, species: 'goat' }),
      this.recordModel.countDocuments({
        ...baseFilter,
        inspectionStatus: SlaughterInspectionStatus.Pending,
        status: { $in: [SlaughterRecordStatus.Scheduled, SlaughterRecordStatus.InProgress] },
      }),
      this.recordModel.countDocuments({
        ...baseFilter,
        scheduledDate: { $gte: todayStart, $lte: todayEnd },
        status: SlaughterRecordStatus.Scheduled,
      }),
      this.buildAnimalsRegisteredTable(facilityId),
    ]);

    const processAlerts: { type: string; count: number; message: string }[] = [];
    if (pendingInspections > 0) {
      processAlerts.push({
        type: 'inspection_pending',
        count: pendingInspections,
        message: `${pendingInspections} animal(s) awaiting ante-mortem inspection`,
      });
    }
    if (scheduledToday > 0) {
      processAlerts.push({
        type: 'scheduled_today',
        count: scheduledToday,
        message: `${scheduledToday} slaughter(s) scheduled for today`,
      });
    }

    return {
      facility,
      totalCattle: cattleCount,
      totalGoat: goatCount,
      pendingInspections,
      scheduledToday,
      processAlerts,
      recentSlaughtered,
      animalsRegisteredTable,
    };
  }

  async listOperatorLivestock(
    operatorId: string,
    pagination: PaginationDto,
    species?: string,
  ) {
    const facility = await this.getFacilityByOperator(operatorId);
    if (!facility) {
      return { items: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } };
    }

    const table = await this.buildAnimalsRegisteredTable(facility._id, species);
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;
    const items = table.slice(skip, skip + limit);
    const total = table.length;
    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  private async buildAnimalsRegisteredTable(
    facilityId: Types.ObjectId,
    species?: string,
  ) {
    const match: Record<string, unknown> = {
      slaughterhouseId: facilityId,
      status: { $ne: SlaughterRecordStatus.Cancelled },
    };
    if (species) match.species = species;

    const rows = await this.recordModel.aggregate([
      { $match: match },
      { $sort: { scheduledDate: -1 } },
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
          from: 'users',
          localField: 'farmerId',
          foreignField: '_id',
          as: 'farmerDoc',
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
        $addFields: {
          livestockId: { $ifNull: [{ $arrayElemAt: ['$animalDoc.tagId', 0] }, '—'] },
          type: { $ifNull: ['$species', { $arrayElemAt: ['$animalDoc.species', 0] }] },
          breed: { $arrayElemAt: ['$animalDoc.breed', 0] },
          registeredBy: { $arrayElemAt: ['$farmerDoc.name', 0] },
          farmerId: { $toString: '$farmerId' },
          healthStatus: {
            $ifNull: [
              { $arrayElemAt: ['$animalDoc.healthStatus', 0] },
              '$healthStatusLabel',
            ],
          },
          lastVeterinaryVisit: { $arrayElemAt: ['$lastVisit.visitDate', 0] },
          lastVaccinationDate: { $arrayElemAt: ['$lastVisit.visitDate', 0] },
          animalId: { $toString: '$animalId' },
          recordId: { $toString: '$_id' },
          scheduledDate: 1,
          status: 1,
          inspectionStatus: 1,
        },
      },
      { $project: { animalDoc: 0, farmerDoc: 0, lastVisit: 0 } },
    ]);

    return rows;
  }

  private async assertOperatorFacilityRecord(record: SlaughterRecordDocument, operatorId: string) {
    const facility = await this.getFacilityByOperator(operatorId);
    if (!facility || String(record.slaughterhouseId) !== String(facility._id)) {
      throw new ForbiddenException('This record does not belong to your facility');
    }
    return facility;
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
    const saved = await record.save();
    const recordId = String(saved._id);
    const dateLabel = saved.scheduledDate.toISOString().slice(0, 10);

    void this.notificationService.notify(farmerId, {
      title: 'Slaughter scheduled',
      message: `Slaughter for ${animal.name} is scheduled at ${facility.name} on ${dateLabel}.`,
      type: NotificationType.Slaughter,
      relatedId: recordId,
      relatedType: NotificationRelatedType.SlaughterRecord,
    });

    if (facility.ownerId) {
      void this.notificationService.notify(facility.ownerId, {
        title: 'New slaughter booking',
        message: `${animal.name} (${animal.species}) was scheduled at your facility on ${dateLabel}.`,
        type: NotificationType.Slaughter,
        relatedId: recordId,
        relatedType: NotificationRelatedType.SlaughterRecord,
      });

      const priorFromFarmer = await this.recordModel.countDocuments({
        slaughterhouseId: facility._id,
        farmerId: animal.farmerId,
        _id: { $ne: saved._id },
      });
      if (priorFromFarmer === 0) {
        const farmer = await this.userModel.findById(animal.farmerId).lean().exec();
        void this.notificationService.notify(facility.ownerId, {
          title: 'New farmer',
          message: farmer
            ? `${farmer.name} has connected through a slaughter booking.`
            : 'A new farmer has been connected through a slaughter booking.',
          type: NotificationType.General,
          relatedId: String(animal.farmerId),
          relatedType: NotificationRelatedType.User,
        });
      }
    }

    return saved;
  }

  async findRecords(userId: string, role: Role, pagination: PaginationDto) {
    let filter: Record<string, unknown> = {};

    if (role === Role.Farmer) {
      filter = { farmerId: new Types.ObjectId(userId) };
    } else if (role === Role.Slaughterhouse) {
      const facility = await this.getFacilityByOperator(userId);
      if (!facility) {
        const page = pagination.page ?? 1;
        const limit = pagination.limit ?? 10;
        return { items: [], meta: { total: 0, page, limit, totalPages: 0 } };
      }
      filter = { slaughterhouseId: facility._id };
    }

    return this.paginateRecords(filter, pagination);
  }

  async findOneRecord(id: string, userId: string, role: Role) {
    const record = await this.recordModel.findById(id).lean().exec();
    if (!record) throw new NotFoundException('Slaughter record not found');
    if (role === Role.Admin) return record;
    if (role === Role.Farmer && String(record.farmerId) !== userId) {
      throw new ForbiddenException('You cannot access this slaughter record');
    }
    if (role === Role.Slaughterhouse) {
      const facility = await this.getFacilityByOperator(userId);
      if (!facility || String(record.slaughterhouseId) !== String(facility._id)) {
        throw new ForbiddenException('You cannot access this slaughter record');
      }
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

    if (role === Role.Slaughterhouse) {
      await this.assertOperatorFacilityRecord(record, userId);
      if (dto.status === SlaughterRecordStatus.Cancelled) {
        throw new ForbiddenException('Operators cannot cancel records; contact the farmer or admin');
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
    const previousStatus = record.status;
    const previousInspection = record.inspectionStatus;

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

    const saved = await record.save();
    await this.notifySlaughterRecordChanges(saved, {
      previousStatus,
      previousInspection,
      statusChanged: dto.status !== undefined && dto.status !== previousStatus,
      inspectionChanged:
        dto.inspectionStatus !== undefined && dto.inspectionStatus !== previousInspection,
    });
    return saved;
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

  private async notifySlaughterRecordChanges(
    record: SlaughterRecordDocument,
    ctx: {
      previousStatus: SlaughterRecordStatus;
      previousInspection: SlaughterInspectionStatus;
      statusChanged: boolean;
      inspectionChanged: boolean;
    },
  ) {
    const recordId = String(record._id);
    const animalLabel = record.animalName ?? 'Livestock';
    const farmerId = String(record.farmerId);

    if (ctx.statusChanged) {
      if (record.status === SlaughterRecordStatus.Completed) {
        void this.notificationService.notify(farmerId, {
          title: 'Slaughter completed',
          message: `Slaughter for ${animalLabel} has been completed.`,
          type: NotificationType.Slaughter,
          relatedId: recordId,
          relatedType: NotificationRelatedType.SlaughterRecord,
        });
      } else if (record.status === SlaughterRecordStatus.Cancelled) {
        void this.notificationService.notify(farmerId, {
          title: 'Slaughter cancelled',
          message: `The scheduled slaughter for ${animalLabel} was cancelled.`,
          type: NotificationType.Slaughter,
          relatedId: recordId,
          relatedType: NotificationRelatedType.SlaughterRecord,
        });
        const facility = await this.facilityModel.findById(record.slaughterhouseId).lean().exec();
        if (facility?.ownerId) {
          void this.notificationService.notify(facility.ownerId, {
            title: 'Slaughter booking cancelled',
            message: `A booking for ${animalLabel} was cancelled.`,
            type: NotificationType.Slaughter,
            relatedId: recordId,
            relatedType: NotificationRelatedType.SlaughterRecord,
          });
        }
      }
    }

    if (
      ctx.inspectionChanged &&
      record.inspectionStatus !== SlaughterInspectionStatus.Pending
    ) {
      void this.notificationService.notify(farmerId, {
        title: 'Slaughter inspection update',
        message: `Inspection for ${animalLabel} is now ${record.inspectionStatus}.`,
        type: NotificationType.Slaughter,
        relatedId: recordId,
        relatedType: NotificationRelatedType.SlaughterRecord,
      });
    }
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
