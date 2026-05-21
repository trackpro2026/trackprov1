import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../user/entities/user.entity';
import { Animal, AnimalDocument } from '../animal/entities/animal.entity';
import { Slaughterhouse, SlaughterhouseDocument } from '../slaughterhouse/entities/slaughterhouse.entity';
import { Role } from '../../common/decorators/roles.decorator';

@Injectable()
export class MapService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Animal.name) private animalModel: Model<AnimalDocument>,
    @InjectModel(Slaughterhouse.name) private facilityModel: Model<SlaughterhouseDocument>,
  ) {}

  async getMarkers(userId: string, role: Role) {
    const farmers =
      role === Role.Admin || role === Role.Doctor
        ? await this.userModel
            .find({ role: Role.Farmer })
            .select('name farmName farmLocation latitude longitude')
            .lean()
        : [];

    const animalFilter =
      role === Role.Farmer
        ? { farmerId: new Types.ObjectId(userId) }
        : role === Role.Doctor
          ? { assignedDoctorId: new Types.ObjectId(userId) }
          : {};

    const animals = Object.keys(animalFilter).length || role === Role.Admin
      ? await this.animalModel
          .find(role === Role.Admin ? {} : animalFilter)
          .select('name tagId species pastureOrPen farmerId')
          .lean()
      : [];

    const slaughterhouses = await this.facilityModel
      .find(role === Role.Slaughterhouse ? { ownerId: userId } : { status: 'approved' })
      .select('name location state latitude longitude facilityCode ownerName')
      .lean();

    return {
      farmers: farmers.map((f) => ({
        id: String(f._id),
        name: f.name,
        label: f.farmName ?? f.name,
        location: f.farmLocation,
        latitude: f.latitude,
        longitude: f.longitude,
      })),
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
