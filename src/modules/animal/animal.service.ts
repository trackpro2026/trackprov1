import {
  ConflictException,
  ForbiddenException,
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Animal,
  AnimalDocument,
  AnimalHealthStatus,
  AnimalObtainedBy,
  AnimalStatus,
} from './entities/animal.entity';
import {
  HealthRecord,
  HealthRecordDocument,
  VisitStatus,
} from '../health-record/entities/health-record.entity';
import { User, UserDocument } from '../user/entities/user.entity';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { UpdateAnimalDto } from './dto/update-animal.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ListLivestockQueryDto } from './dto/list-livestock-query.dto';
import { FarmerOverviewQueryDto } from './dto/farmer-overview-query.dto';
import { TransferLivestockDto } from './dto/transfer-livestock.dto';
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
    @InjectModel(HealthRecord.name) private healthRecordModel: Model<HealthRecordDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
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
      dateObtained: dto.dateObtained ? new Date(dto.dateObtained) : undefined,
      assignedDoctorId: dto.assignedDoctorId
        ? new Types.ObjectId(dto.assignedDoctorId)
        : undefined,
    });
    const saved = await animal.save();
    if (dto.assignedDoctorId) {
      const doctorId = dto.assignedDoctorId;
      const priorForFarmer = await this.animalModel.countDocuments({
        farmerId: new Types.ObjectId(farmerId),
        assignedDoctorId: new Types.ObjectId(doctorId),
        _id: { $ne: saved._id },
      });
      if (priorForFarmer === 0) {
        const farmer = await this.userModel.findById(farmerId).lean().exec();
        void this.notificationService.notify(doctorId, {
          title: 'New farmer',
          message: farmer
            ? `${farmer.name} has been added to your network.`
            : 'A new farmer has been added to the system.',
          type: NotificationType.General,
          relatedId: farmerId,
          relatedType: NotificationRelatedType.User,
        });
      }
      void this.notificationService.notify(doctorId, {
        title: 'New animal',
        message: `A new animal was registered: ${saved.name} (${saved.tagId}).`,
        type: NotificationType.Livestock,
        relatedId: String(saved._id),
        relatedType: NotificationRelatedType.Animal,
      });
    }
    return saved;
  }

  async findForFarmer(farmerId: string, pagination: PaginationDto, query?: ListLivestockQueryDto) {
    return this.findForFarmerEnriched(farmerId, pagination, query);
  }

  async getFarmerLivestockStats(farmerId: string) {
    const uid = new Types.ObjectId(farmerId);
    const [totalLivestock, healthyLivestock, sickLivestock] = await Promise.all([
      this.animalModel.countDocuments({ farmerId: uid }),
      this.animalModel.countDocuments({
        farmerId: uid,
        healthStatus: AnimalHealthStatus.Healthy,
      }),
      this.animalModel.countDocuments({
        farmerId: uid,
        healthStatus: { $in: [AnimalHealthStatus.Sick, AnimalHealthStatus.UnderTreatment] },
      }),
    ]);
    return { totalLivestock, healthyLivestock, sickLivestock };
  }

  async getFarmerOverview(farmerId: string, period?: FarmerOverviewQueryDto) {
    const uid = new Types.ObjectId(farmerId);
    const { start, end, month, year } = this.resolvePeriod(period);

    const [
      livestockStats,
      veterinaryVisitsInPeriod,
      pendingVisits,
      livestockTable,
      visitsByMonth,
    ] = await Promise.all([
      this.getFarmerLivestockStats(farmerId),
      this.healthRecordModel.countDocuments({
        farmerId: uid,
        visitDate: { $gte: start, $lte: end },
      }),
      this.healthRecordModel.countDocuments({
        farmerId: uid,
        status: VisitStatus.Pending,
      }),
      this.buildFarmerLivestockTable(uid, 10),
      this.getVisitsByMonthForFarmer(farmerId, 12),
    ]);

    return {
      period: { month, year, start, end },
      summaryCards: {
        totalLivestock: livestockStats.totalLivestock,
        healthyLivestock: livestockStats.healthyLivestock,
        sickLivestock: livestockStats.sickLivestock,
        veterinaryVisits: veterinaryVisitsInPeriod,
      },
      ...livestockStats,
      veterinaryVisitsInPeriod,
      pendingVeterinaryVisits: pendingVisits,
      livestockOnTreatment: livestockStats.sickLivestock,
      visitsByMonth,
      livestockTable,
    };
  }

  async findOneDetailedForFarmer(id: string, farmerId: string) {
    const animal = await this.animalModel.findById(id).lean().exec();
    if (!animal) throw new NotFoundException('Animal not found');
    if (String(animal.farmerId) !== farmerId) {
      throw new ForbiddenException('You cannot access this animal');
    }
    return this.buildLivestockDetailResponse(id, animal);
  }

  /** Figma Add Slaughter — scan QR / tag lookup (any active livestock). */
  async lookupLivestockForSlaughterScan(input: {
    tagId?: string;
    animalId?: string;
    qrPayload?: string;
  }) {
    const animal = await this.resolveAnimalFromScan(input);
    return this.buildSlaughterScanResponse(animal);
  }

  /** Figma slaughterhouse livestock detail (no farmer ownership check). */
  async findOneDetailedForSlaughterhouse(id: string) {
    const animal = await this.animalModel.findById(id).lean().exec();
    if (!animal) throw new NotFoundException('Animal not found');
    return this.buildLivestockDetailResponse(id, animal);
  }

  async resolveAnimalFromScan(input: {
    tagId?: string;
    animalId?: string;
    qrPayload?: string;
  }) {
    const { tagId: parsedTag, animalId: parsedId } = this.parseScanInput(input);
    if (parsedId && Types.ObjectId.isValid(parsedId)) {
      const byId = await this.animalModel.findById(parsedId).exec();
      if (byId) return byId;
    }
    if (parsedTag) {
      const byTag = await this.animalModel.findOne({ tagId: parsedTag }).exec();
      if (byTag) return byTag;
    }
    throw new NotFoundException('Livestock not found for this scan');
  }

  private parseScanInput(input: {
    tagId?: string;
    animalId?: string;
    qrPayload?: string;
  }) {
    if (input.qrPayload?.trim()) {
      const raw = input.qrPayload.trim();
      if (raw.startsWith('trackpro:livestock:')) {
        const parts = raw.split(':');
        return { tagId: parts[2], animalId: parts[3] };
      }
      if (Types.ObjectId.isValid(raw)) {
        return { tagId: undefined, animalId: raw };
      }
      return { tagId: raw, animalId: undefined };
    }
    return { tagId: input.tagId?.trim(), animalId: input.animalId?.trim() };
  }

  private async buildSlaughterScanResponse(animal: AnimalDocument | Record<string, unknown>) {
    const animalId = String((animal as { _id: Types.ObjectId })._id);
    const visitCount = await this.healthRecordModel.countDocuments({
      animalId: new Types.ObjectId(animalId),
    });
    const farmer = await this.userModel
      .findById((animal as { farmerId: Types.ObjectId }).farmerId)
      .select('name')
      .lean()
      .exec();
    const healthStatus = (animal as { healthStatus?: AnimalHealthStatus }).healthStatus;
    const status = (animal as { status?: AnimalStatus }).status;
    const healthy = healthStatus === AnimalHealthStatus.Healthy;
    const alreadySlaughtered = status === AnimalStatus.Slaughtered;

    return {
      livestock: {
        id: animalId,
        livestockId: (animal as { tagId: string }).tagId,
        gender: (animal as { sex?: string }).sex,
        obtainedBy: (animal as { obtainedBy?: string }).obtainedBy,
        healthStatus,
        dateObtained:
          (animal as { dateObtained?: Date }).dateObtained ??
          (animal as { dateOfBirth?: Date }).dateOfBirth,
        numberOfVeterinaryVisits: visitCount,
        type: this.buildTypeLabel(
          animal as { breedType?: string; breed?: string; species?: string },
        ),
        profileImageUrl: (animal as { imageUrls?: string[] }).imageUrls?.[0],
        ownerName: farmer?.name,
        species: (animal as { species?: string }).species,
        breed: (animal as { breed?: string }).breed,
        status,
      },
      canSlaughter: healthy && !alreadySlaughtered,
      slaughterBlockedReason: alreadySlaughtered
        ? 'This livestock has already been slaughtered.'
        : !healthy
          ? 'Livestock must be healthy before it can be slaughtered!'
          : undefined,
    };
  }

  private async buildLivestockDetailResponse(id: string, animal: AnimalDocument | Record<string, unknown>) {
    const a = animal as {
      _id: Types.ObjectId;
      tagId: string;
      farmerId: Types.ObjectId;
      assignedDoctorId?: Types.ObjectId;
      species?: string;
      sex?: string;
      obtainedBy?: string;
      healthStatus?: string;
      dateObtained?: Date;
      dateOfBirth?: Date;
      imageUrls?: string[];
      breed?: string;
      breedType?: string;
    };
    const [visits, visitTypeBreakdown, assignedVet] = await Promise.all([
      this.healthRecordModel
        .find({ animalId: id })
        .sort({ visitDate: -1 })
        .limit(20)
        .lean(),
      this.healthRecordModel.aggregate([
        { $match: { animalId: new Types.ObjectId(id) } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      a.assignedDoctorId
        ? this.userModel
            .findById(a.assignedDoctorId)
            .select('name email phone doctorProfile')
            .lean()
            .exec()
        : null,
    ]);

    const lastVisit = visits[0];
    const enrichedVisits = await Promise.all(
      visits.map(async (v) => {
        const doctor = await this.userModel.findById(v.doctorId).select('name avatarUrl').lean();
        return {
          ...v,
          id: String(v._id),
          visitId: String(v._id),
          livestockId: a.tagId,
          summary: v.reason ?? v.type,
          visitDateTime: v.visitDate,
          veterinarianName: doctor?.name,
        };
      }),
    );

    return {
      livestock: {
        ...animal,
        id: String(animal._id),
          livestockId: a.tagId,
          type: this.buildTypeLabel(a),
          category: a.species,
          gender: a.sex,
          profileImageUrl: a.imageUrls?.[0],
          dateObtained: a.dateObtained ?? a.dateOfBirth,
          numberOfVeterinaryVisits: visits.length,
          ageYears: this.ageYearsFromBirth(a.dateOfBirth),
        },
      visitType: lastVisit?.type ?? 'checkup',
      healthStatusLabel: a.healthStatus,
      visitTypeChart: visitTypeBreakdown.map((r) => ({ type: r._id, count: r.count })),
      visitsByMonth: await this.getVisitsByMonthForAnimal(id, 12),
      veterinarian: assignedVet
        ? {
            id: String(assignedVet._id),
            name: assignedVet.name,
            email: assignedVet.email,
            phoneNumber: assignedVet.phone,
            clinicName: assignedVet.doctorProfile?.clinicName,
          }
        : lastVisit
          ? await this.userModel
              .findById(lastVisit.doctorId)
              .select('name email phone doctorProfile')
              .lean()
              .then((d) =>
                d
                  ? {
                      id: String(d._id),
                      name: d.name,
                      email: d.email,
                      phoneNumber: d.phone,
                      clinicName: d.doctorProfile?.clinicName,
                    }
                  : null,
              )
          : null,
      veterinaryVisits: enrichedVisits,
    };
  }

  async findForDoctor(doctorId: string, pagination: PaginationDto) {
    return this.paginate({ assignedDoctorId: new Types.ObjectId(doctorId) }, pagination);
  }

  async findAllAdmin(pagination: PaginationDto) {
    return this.paginate({}, pagination);
  }

  async findOne(id: string, userId: string, role: Role) {
    if (role === Role.Farmer) {
      return this.findOneDetailedForFarmer(id, userId);
    }
    return this.findOneRaw(id, userId, role);
  }

  private async findOneRaw(id: string, userId: string, role: Role) {
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
    const before = await this.findOneRaw(id, userId, role);
    const previousDoctorId = before.assignedDoctorId
      ? String(before.assignedDoctorId)
      : undefined;
    const patch: Record<string, unknown> = { ...dto };
    if (dto.dateOfBirth) patch.dateOfBirth = new Date(dto.dateOfBirth);
    if (dto.dateObtained) patch.dateObtained = new Date(dto.dateObtained);
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

    if (dto.healthStatus && dto.healthStatus !== before.healthStatus) {
      void this.notificationService.notify(String(updated.farmerId), {
        title: 'Livestock health updated',
        message: `${updated.name} (${updated.tagId}) is now marked ${dto.healthStatus}.`,
        type: NotificationType.Livestock,
        relatedId: id,
        relatedType: NotificationRelatedType.Animal,
      });
      if (updated.assignedDoctorId) {
        void this.notificationService.notify(String(updated.assignedDoctorId), {
          title: 'Livestock health status updated',
          message: `${updated.name} (${updated.tagId}) is now marked ${dto.healthStatus}.`,
          type: NotificationType.Livestock,
          relatedId: id,
          relatedType: NotificationRelatedType.Animal,
        });
      }
    }

    return updated;
  }

  async remove(id: string, userId: string, role: Role) {
    await this.findOneRaw(id, userId, role);
    await this.animalModel.findByIdAndDelete(id).exec();
    return { message: 'Animal removed' };
  }

  async transferLivestock(id: string, farmerId: string, dto: TransferLivestockDto) {
    const animal = await this.animalModel.findById(id).exec();
    if (!animal) throw new NotFoundException('Animal not found');
    if (String(animal.farmerId) !== farmerId) {
      throw new ForbiddenException('You cannot transfer this animal');
    }
    if (animal.status === AnimalStatus.Slaughtered) {
      throw new BadRequestException('This animal has already been slaughtered');
    }

    const phone = dto.receiverPhone.replace(/\s/g, '');
    const receiverQuery: Record<string, unknown> = {
      role: Role.Farmer,
      $or: [{ phone }],
    };
    if (dto.receiverEmail) {
      receiverQuery.$or = [{ phone }, { email: dto.receiverEmail.toLowerCase() }];
    }
    const receiver = await this.userModel.findOne(receiverQuery).exec();
    if (!receiver) {
      throw new BadRequestException(
        'No farmer account found for the receiver phone or email. They must register first.',
      );
    }
    if (String(receiver._id) === farmerId) {
      throw new BadRequestException('Cannot transfer livestock to yourself');
    }

    animal.farmerId = receiver._id as Types.ObjectId;
    animal.status = AnimalStatus.Transferred;
    animal.assignedDoctorId = undefined;
    await animal.save();

    void this.notificationService.notify(String(receiver._id), {
      title: 'Livestock transferred to you',
      message: `${dto.receiverFirstName} received ${animal.name} (${animal.tagId}) from a farmer transfer.`,
      type: NotificationType.Livestock,
      relatedId: id,
      relatedType: NotificationRelatedType.Animal,
    });

    return {
      message: 'Livestock transferred successfully',
      livestockId: animal.tagId,
      newOwnerId: String(receiver._id),
      newOwnerName: receiver.name,
    };
  }

  async markSlaughtered(id: string, farmerId: string) {
    const animal = await this.animalModel.findById(id).exec();
    if (!animal) throw new NotFoundException('Animal not found');
    if (String(animal.farmerId) !== farmerId) {
      throw new ForbiddenException('You cannot update this animal');
    }
    animal.status = AnimalStatus.Slaughtered;
    await animal.save();
    return {
      message: 'Livestock marked as slaughtered',
      livestockId: animal.tagId,
      status: animal.status,
    };
  }

  async getQrCode(id: string, farmerId: string) {
    const animal = await this.animalModel.findById(id).lean().exec();
    if (!animal) throw new NotFoundException('Animal not found');
    if (String(animal.farmerId) !== farmerId) {
      throw new ForbiddenException('You cannot access this animal');
    }
    const qrPayload = `trackpro:livestock:${animal.tagId}:${id}`;
    const QRCode = await import('qrcode');
    const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'M',
    });
    return {
      livestockId: animal.tagId,
      animalId: id,
      name: animal.name,
      profileImageUrl: animal.imageUrls?.[0],
      qrPayload,
      qrCodeDataUrl,
      scanUrl: `/api/v1/livestock/${id}`,
    };
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

  private async findForFarmerEnriched(
    farmerId: string,
    pagination: PaginationDto,
    query?: ListLivestockQueryDto,
  ) {
    const filter: Record<string, unknown> = { farmerId: new Types.ObjectId(farmerId) };
    if (query?.species) filter.species = query.species;
    if (query?.healthStatus) filter.healthStatus = query.healthStatus;
    if (query?.obtainedBy) filter.obtainedBy = query.obtainedBy;
    if (query?.search?.trim()) {
      const regex = { $regex: query.search.trim(), $options: 'i' };
      filter.$or = [{ tagId: regex }, { name: regex }];
    }

    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.animalModel.aggregate([
        { $match: filter },
        { $sort: { updatedAt: -1 } },
        { $skip: skip },
        { $limit: limit },
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
              $cond: {
                if: { $and: ['$breedType', '$breed'] },
                then: { $concat: ['$breedType', ' (', '$breed', ')'] },
                else: {
                  $cond: {
                    if: { $and: ['$species', '$breed'] },
                    then: { $concat: ['$species', ' / ', '$breed'] },
                    else: { $ifNull: ['$breedType', { $ifNull: ['$breed', '$species'] }] },
                  },
                },
              },
            },
            addressLabel: '$pastureOrPen',
            lastVeterinaryVisit: { $arrayElemAt: ['$lastVisit.visitDate', 0] },
          },
        },
        { $project: { lastVisit: 0 } },
      ]),
      this.animalModel.countDocuments(filter),
    ]);

    return {
      items: items.map((a) => this.mapLivestockListItem(a)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  private mapLivestockListItem(a: Record<string, unknown>) {
    return {
      ...a,
      id: String(a._id),
      livestockId: a.tagId ?? a.livestockId,
      type: a.type ?? this.buildTypeLabel(a as { breedType?: string; breed?: string; species?: string }),
      gender: a.sex,
      obtainedBy: a.obtainedBy,
      healthStatus: a.healthStatus,
      lastVeterinaryVisit: a.lastVeterinaryVisit,
      profileImageUrl: Array.isArray(a.imageUrls) ? a.imageUrls[0] : undefined,
    };
  }

  private buildTypeLabel(a: { breedType?: string; breed?: string; species?: string }) {
    if (a.breedType && a.breed) return `${a.breedType} (${a.breed})`;
    if (a.species && a.breed) return `${a.species} / ${a.breed}`;
    return a.breedType ?? a.breed ?? a.species ?? '';
  }

  private async buildFarmerLivestockTable(farmerId: Types.ObjectId, limit: number) {
    const rows = await this.animalModel.aggregate([
      { $match: { farmerId } },
      { $sort: { updatedAt: -1 } },
      { $limit: limit },
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
          addressLabel: '$pastureOrPen',
          lastVeterinaryVisit: { $arrayElemAt: ['$lastVisit.visitDate', 0] },
        },
      },
      { $project: { lastVisit: 0 } },
    ]);
    return rows.map((a) => this.mapLivestockListItem(a));
  }

  private resolvePeriod(period?: FarmerOverviewQueryDto) {
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

  private async getVisitsByMonthForFarmer(farmerId: string, months: number) {
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);
    const rows = await this.healthRecordModel.aggregate([
      { $match: { farmerId: new Types.ObjectId(farmerId), visitDate: { $gte: since } } },
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

  private async getVisitsByMonthForAnimal(animalId: string, months: number) {
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);
    const rows = await this.healthRecordModel.aggregate([
      { $match: { animalId: new Types.ObjectId(animalId), visitDate: { $gte: since } } },
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
