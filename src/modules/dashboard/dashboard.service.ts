import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Animal, AnimalDocument } from '../animal/entities/animal.entity';
import { HealthRecord, HealthRecordDocument } from '../health-record/entities/health-record.entity';
import { TrackingEvent, TrackingEventDocument } from '../tracking/entities/tracking-event.entity';
import { User, UserDocument } from '../user/entities/user.entity';
import { AnimalService } from '../animal/animal.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Animal.name) private animalModel: Model<AnimalDocument>,
    @InjectModel(HealthRecord.name) private healthRecordModel: Model<HealthRecordDocument>,
    @InjectModel(TrackingEvent.name) private trackingModel: Model<TrackingEventDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly animalService: AnimalService,
  ) {}

  async getFarmerDashboard(farmerId: string) {
    const uid = new Types.ObjectId(farmerId);
    const [animalStats, recentAnimals, recentTracking, sickCount] = await Promise.all([
      this.animalService.getStatsForFarmer(farmerId),
      this.animalModel.find({ farmerId: uid }).sort({ updatedAt: -1 }).limit(5).lean(),
      this.trackingModel.find({ farmerId: uid }).sort({ recordedAt: -1 }).limit(5).lean(),
      this.animalModel.countDocuments({ farmerId: uid, healthStatus: 'sick' }),
    ]);
    return {
      animalStats,
      sickCount,
      recentAnimals,
      recentTracking,
    };
  }

  async getDoctorDashboard(doctorId: string) {
    const did = new Types.ObjectId(doctorId);
    const [assignedAnimals, recentRecords, farmerCount] = await Promise.all([
      this.animalModel
        .find({ assignedDoctorId: did })
        .sort({ updatedAt: -1 })
        .limit(10)
        .lean(),
      this.healthRecordModel
        .find({ doctorId: did })
        .sort({ visitDate: -1 })
        .limit(10)
        .lean(),
      this.animalModel.distinct('farmerId', { assignedDoctorId: did }),
    ]);
    return {
      assignedAnimalCount: assignedAnimals.length,
      farmerCount: farmerCount.length,
      assignedAnimals,
      recentHealthRecords: recentRecords,
    };
  }
}
