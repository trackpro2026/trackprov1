import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Animal, AnimalDocument } from '../animal/entities/animal.entity';
import { HealthRecord, HealthRecordDocument } from '../health-record/entities/health-record.entity';
import { User, UserDocument } from '../user/entities/user.entity';
import { AnimalService } from '../animal/animal.service';
import { HealthRecordService } from '../health-record/health-record.service';
import { SlaughterhouseService } from '../slaughterhouse/slaughterhouse.service';
import { VisitStatus } from '../health-record/entities/health-record.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Animal.name) private animalModel: Model<AnimalDocument>,
    @InjectModel(HealthRecord.name) private healthRecordModel: Model<HealthRecordDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly animalService: AnimalService,
    private readonly healthRecordService: HealthRecordService,
    private readonly slaughterhouseService: SlaughterhouseService,
  ) {}

  async getFarmerDashboard(farmerId: string) {
    const uid = new Types.ObjectId(farmerId);
    const [animalStats, recentAnimals, sickCount, veterinaryVisits] = await Promise.all([
      this.animalService.getStatsForFarmer(farmerId),
      this.animalModel.find({ farmerId: uid }).sort({ updatedAt: -1 }).limit(5).lean(),
      this.animalModel.countDocuments({ farmerId: uid, healthStatus: 'sick' }),
      this.healthRecordModel.countDocuments({ farmerId: uid }),
    ]);
    const livestockTable = await this.animalModel.aggregate([
      { $match: { farmerId: uid } },
      { $sort: { updatedAt: -1 } },
      { $limit: 10 },
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
          livestockId: { $toString: '$_id' },
          type: '$species',
          lastVeterinaryVisit: { $arrayElemAt: ['$lastVisit.visitDate', 0] },
          lastVaccinationDate: { $arrayElemAt: ['$lastVisit.visitDate', 0] },
        },
      },
      { $project: { lastVisit: 0 } },
    ]);

    const healthyCount = await this.animalModel.countDocuments({
      farmerId: uid,
      healthStatus: 'healthy',
    });
    const onTreatmentCount = await this.animalModel.countDocuments({
      farmerId: uid,
      healthStatus: { $in: ['sick', 'under_treatment'] },
    });

    return {
      animalStats,
      sickCount,
      totalLivestock: animalStats.totalActive,
      healthyLivestock: healthyCount,
      veterinaryVisits,
      livestockOnTreatment: onTreatmentCount,
      recentAnimals,
      livestockTable,
    };
  }

  async getDoctorDashboard(doctorId: string) {
    const did = new Types.ObjectId(doctorId);
    const [assignedAnimals, visitStats, recentVisits] = await Promise.all([
      this.animalModel
        .find({ assignedDoctorId: did })
        .sort({ updatedAt: -1 })
        .limit(10)
        .lean(),
      this.healthRecordService.getDoctorVisitStats(doctorId),
      this.healthRecordService.findForDoctor(doctorId, { page: 1, limit: 10 }),
    ]);
    return {
      ...visitStats,
      assignedAnimals,
      recentVeterinaryVisits: recentVisits.items,
    };
  }

  async getSlaughterhouseDashboard(operatorId: string) {
    return this.slaughterhouseService.getOperatorOverview(operatorId);
  }

  async getAdminDashboard() {
    const [farmers, doctors, animals, healthRecords, slaughterhouses, pendingVisits] =
      await Promise.all([
        this.userModel.countDocuments({ role: 'farmer' }),
        this.userModel.countDocuments({ role: 'doctor' }),
        this.animalModel.countDocuments(),
        this.healthRecordModel.countDocuments(),
        this.slaughterhouseService.listFacilities(true).then((f) => f.length),
        this.healthRecordModel.countDocuments({ status: VisitStatus.Pending }),
      ]);
    return {
      farmers,
      doctors,
      animals,
      healthRecords,
      slaughterhouses,
      pendingVisits,
    };
  }
}
