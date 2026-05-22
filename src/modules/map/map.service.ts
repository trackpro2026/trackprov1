import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../user/entities/user.entity';
import { Animal, AnimalDocument } from '../animal/entities/animal.entity';
import { Slaughterhouse, SlaughterhouseDocument } from '../slaughterhouse/entities/slaughterhouse.entity';
import {
  SlaughterRecord,
  SlaughterRecordDocument,
  SlaughterRecordStatus,
} from '../slaughterhouse/entities/slaughter-record.entity';
import { Role } from '../../common/decorators/roles.decorator';

@Injectable()
export class MapService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Animal.name) private animalModel: Model<AnimalDocument>,
    @InjectModel(Slaughterhouse.name) private facilityModel: Model<SlaughterhouseDocument>,
    @InjectModel(SlaughterRecord.name)
    private slaughterRecordModel: Model<SlaughterRecordDocument>,
  ) {}

  async getMarkers(userId: string, role: Role) {
    const farmers =
      role === Role.Admin || role === Role.Doctor
        ? await this.userModel
            .find({ role: Role.Farmer })
            .select('name farmName farmLocation latitude longitude')
            .lean()
        : [];

    let animals: Array<{
      _id: Types.ObjectId;
      name: string;
      tagId: string;
      species: string;
      pastureOrPen?: string;
      farmerId: Types.ObjectId;
    }> = [];

    if (role === Role.Farmer) {
      animals = await this.animalModel
        .find({ farmerId: new Types.ObjectId(userId) })
        .select('name tagId species pastureOrPen farmerId')
        .lean();
    } else if (role === Role.Doctor) {
      animals = await this.animalModel
        .find({ assignedDoctorId: new Types.ObjectId(userId) })
        .select('name tagId species pastureOrPen farmerId')
        .lean();
    } else if (role === Role.Slaughterhouse) {
      const facility = await this.facilityModel.findOne({ ownerId: userId }).lean().exec();
      if (facility) {
        const records = await this.slaughterRecordModel
          .find({
            slaughterhouseId: facility._id,
            status: { $ne: SlaughterRecordStatus.Cancelled },
          })
          .select('animalId')
          .lean();
        const animalIds = [...new Set(records.map((r) => String(r.animalId)))];
        if (animalIds.length) {
          animals = await this.animalModel
            .find({ _id: { $in: animalIds } })
            .select('name tagId species pastureOrPen farmerId')
            .lean();
        }
      }
    } else if (role === Role.Admin) {
      animals = await this.animalModel
        .find()
        .select('name tagId species pastureOrPen farmerId')
        .lean();
    }

    const slaughterhouses = await this.facilityModel
      .find(role === Role.Slaughterhouse ? { ownerId: userId } : { status: 'approved' })
      .select('name location state latitude longitude facilityCode ownerName')
      .lean();

    type FarmerMarker = {
      id: string;
      name: string;
      label: string;
      location?: string;
      latitude?: number;
      longitude?: number;
    };

    let farmerMarkers: FarmerMarker[] = [];
    if (role === Role.Slaughterhouse) {
      const facility = await this.facilityModel.findOne({ ownerId: userId }).lean().exec();
      if (facility) {
        const farmerIds = await this.slaughterRecordModel.distinct('farmerId', {
          slaughterhouseId: facility._id,
        });
        if (farmerIds.length) {
          const linked = await this.userModel
            .find({ _id: { $in: farmerIds }, role: Role.Farmer })
            .select('name farmName farmLocation latitude longitude')
            .lean();
          farmerMarkers = linked.map((f) => ({
            id: String(f._id),
            name: f.name,
            label: f.farmName ?? f.name,
            location: f.farmLocation,
            latitude: f.latitude,
            longitude: f.longitude,
          }));
        }
      }
    } else {
      farmerMarkers = farmers.map((f) => ({
        id: String(f._id),
        name: f.name,
        label: f.farmName ?? f.name,
        location: f.farmLocation,
        latitude: f.latitude,
        longitude: f.longitude,
      }));
    }

    return {
      farmers: farmerMarkers,
      livestock: animals.map((a) => ({
        id: String(a._id),
        tagId: a.tagId,
        name: a.name,
        species: a.species,
        location: a.pastureOrPen,
        farmerId: String(a.farmerId),
      })),
      slaughterhouses: slaughterhouses.map((s) => ({
        id: String(s._id),
        facilityCode: s.facilityCode,
        name: s.name,
        location: s.location,
        state: s.state,
        ownerName: s.ownerName,
        latitude: s.latitude,
        longitude: s.longitude,
      })),
    };
  }
}
