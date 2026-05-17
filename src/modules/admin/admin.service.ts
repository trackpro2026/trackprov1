import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserService } from '../user/user.service';
import { Role } from '../../common/decorators/roles.decorator';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { DoctorStatus } from '../user/entities/doctor-profile.schema';
import { User, UserDocument } from '../user/entities/user.entity';
import { Animal, AnimalDocument } from '../animal/entities/animal.entity';
import { HealthRecord, HealthRecordDocument } from '../health-record/entities/health-record.entity';

@Injectable()
export class AdminService {
  constructor(
    private readonly userService: UserService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Animal.name) private animalModel: Model<AnimalDocument>,
    @InjectModel(HealthRecord.name) private healthRecordModel: Model<HealthRecordDocument>,
  ) {}

  listFarmers(pagination: PaginationDto) {
    return this.userService.findAll(pagination, Role.Farmer);
  }

  listDoctors(pagination: PaginationDto) {
    return this.userService.findAll(pagination, Role.Doctor);
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
    const [farmers, doctors, animals, healthRecords] = await Promise.all([
      this.userModel.countDocuments({ role: Role.Farmer }),
      this.userModel.countDocuments({ role: Role.Doctor }),
      this.animalModel.countDocuments(),
      this.healthRecordModel.countDocuments(),
    ]);
    return {
      farmers,
      doctors,
      animals,
      healthRecords,
    };
  }
}
