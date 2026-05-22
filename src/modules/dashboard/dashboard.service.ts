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
    return this.animalService.getFarmerOverview(farmerId);
  }

  async getDoctorDashboard(doctorId: string) {
    const overview = await this.healthRecordService.getDoctorOverview(doctorId);
    const assignedAnimals = await this.animalModel
      .find({ assignedDoctorId: new Types.ObjectId(doctorId) })
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean();
    return {
      ...overview,
      assignedAnimals,
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
