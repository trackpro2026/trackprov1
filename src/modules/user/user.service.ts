import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { CompleteDoctorProfileDto } from './dto/complete-doctor-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { EncryptionService } from '../../core/encryption/encryption.service';
import { Role } from '../../common/decorators/roles.decorator';
import { UserAccountState } from './entities/user-account-state.enum';
import { DoctorProfileResponse, UserResponse } from './types/user-response.types';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { DoctorProfile, DoctorStatus } from './entities/doctor-profile.schema';
import { ListDoctorsQueryDto } from './dto/list-doctors-query.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private encryptionService: EncryptionService,
  ) {}

  async create(createUserDto: CreateUserDto, role: Role = Role.Farmer) {
    const existing = await this.userModel.findOne({ email: createUserDto.email });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await this.encryptionService.hash(createUserDto.password);
    const user = new this.userModel({
      name: createUserDto.name,
      email: createUserDto.email.toLowerCase(),
      passwordHash,
      role,
      userState:
        role === Role.Doctor ? UserAccountState.Pending : UserAccountState.Active,
      isEmailVerified: role === Role.Admin,
      ...(role === Role.Doctor
        ? { doctorProfile: { status: DoctorStatus.PendingReview } }
        : {}),
    });
    const saved = await user.save();
    return this.toUserResponse(saved);
  }

  async completeDoctorProfile(doctorId: string, dto: CompleteDoctorProfileDto) {
    const user = await this.userModel.findById(doctorId).exec();
    if (!user || user.role !== Role.Doctor) {
      throw new ForbiddenException('Only veterinarians can complete this profile');
    }
    const prev = user.doctorProfile ?? ({} as DoctorProfile);
    user.doctorProfile = {
      ...prev,
      clinicName: dto.clinicName ?? prev.clinicName,
      licenseNumber: dto.licenseNumber ?? prev.licenseNumber,
      location: dto.location ?? prev.location,
      specialties: dto.specialties ?? prev.specialties ?? [],
      speciesTreated: dto.speciesTreated ?? prev.speciesTreated ?? [],
      bio: dto.bio ?? prev.bio,
      documentUrls:
        dto.documentUrls && dto.documentUrls.length > 0
          ? dto.documentUrls
          : prev.documentUrls ?? [],
      profileImageUrl: dto.profileImageUrl ?? prev.profileImageUrl,
      status: prev.status ?? DoctorStatus.PendingReview,
      isVerified: prev.isVerified ?? false,
    };
    user.isEmailVerified = true;
    await user.save();
    return this.toUserResponse(user);
  }

  async appendFarmerFileUrls(farmerId: string, newUrls: string[]) {
    const incoming = newUrls.map((u) => String(u).trim()).filter(Boolean);
    if (incoming.length === 0) {
      const user = await this.userModel.findById(farmerId).exec();
      if (!user) throw new NotFoundException('User not found');
      if (user.role !== Role.Farmer) {
        throw new ForbiddenException('Only farmer accounts can persist uploads here');
      }
      return this.toUserResponse(user);
    }
    const updated = await this.userModel
      .findOneAndUpdate(
        { _id: farmerId, role: Role.Farmer },
        { $addToSet: { userFileUrls: { $each: incoming } } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updated) {
      const existing = await this.userModel.findById(farmerId).lean().exec();
      if (!existing) throw new NotFoundException('User not found');
      throw new ForbiddenException('Only farmer accounts can persist uploads here');
    }
    return this.toUserResponse(updated);
  }

  async appendDoctorDocumentUrls(doctorId: string, newUrls: string[]) {
    const incoming = newUrls.map((u) => String(u).trim()).filter(Boolean);
    const user = await this.userModel.findById(doctorId).exec();
    if (!user || user.role !== Role.Doctor) {
      throw new ForbiddenException('Only veterinarian accounts can persist doctor documents');
    }
    if (incoming.length === 0) {
      return this.toUserResponse(user);
    }
    const prev = user.doctorProfile?.documentUrls ?? [];
    user.doctorProfile = {
      ...(user.doctorProfile ?? { status: DoctorStatus.PendingReview }),
      documentUrls: [...new Set([...prev, ...incoming])],
    };
    await user.save();
    return this.toUserResponse(user);
  }

  async appendAdminFileUrls(userId: string, newUrls: string[]) {
    const incoming = newUrls.map((u) => String(u).trim()).filter(Boolean);
    if (incoming.length === 0) {
      const user = await this.userModel.findById(userId).exec();
      if (!user) throw new NotFoundException('User not found');
      if (user.role !== Role.Admin) {
        throw new ForbiddenException('Only admin accounts can persist uploads here');
      }
      return this.toUserResponse(user);
    }
    const updated = await this.userModel
      .findOneAndUpdate(
        { _id: userId, role: Role.Admin },
        { $addToSet: { adminFileUrls: { $each: incoming } } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updated) {
      const existing = await this.userModel.findById(userId).lean().exec();
      if (!existing) throw new NotFoundException('User not found');
      throw new ForbiddenException('Only admin accounts can persist uploads here');
    }
    return this.toUserResponse(updated);
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async findById(id: string) {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');
    return this.toUserResponse(user);
  }

  async findByEmailAndVerificationOtp(email: string, otp: string) {
    const user = await this.userModel
      .findOne({
        email: email.toLowerCase(),
        emailVerificationToken: otp,
        emailVerificationExpires: { $gt: new Date() },
      })
      .exec();
    if (!user) {
      throw new BadRequestException('Invalid or expired verification code');
    }
    return user;
  }

  async setEmailVerificationToken(userId: string, token: string, expiresAt: Date) {
    await this.userModel
      .findByIdAndUpdate(userId, {
        emailVerificationToken: token,
        emailVerificationExpires: expiresAt,
      })
      .exec();
  }

  async setPasswordResetToken(userId: string, token: string, expiresAt: Date) {
    await this.userModel
      .findByIdAndUpdate(userId, {
        passwordResetToken: token,
        resetUrlToken: token,
        passwordResetExpires: expiresAt,
      })
      .exec();
  }

  async findByResetToken(token: string) {
    return this.userModel
      .findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() },
      })
      .exec();
  }

  async findByResetUrlParams(userId: string, resetUrlToken: string) {
    if (!Types.ObjectId.isValid(userId)) return null;
    return this.userModel
      .findOne({
        _id: userId,
        resetUrlToken,
        passwordResetExpires: { $gt: new Date() },
      })
      .exec();
  }

  async resetPassword(userId: string, newPassword: string) {
    const hash = await this.encryptionService.hash(newPassword);
    await this.userModel
      .findByIdAndUpdate(userId, {
        passwordHash: hash,
        $unset: {
          passwordResetToken: '',
          passwordResetExpires: '',
          resetUrlToken: '',
        },
      })
      .exec();
  }

  async markEmailVerified(userId: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, {
        $set: { isEmailVerified: true },
        $unset: { emailVerificationToken: '', emailVerificationExpires: '' },
      })
      .exec();
  }

  async deleteUnverifiedUser(userId: string, token: string): Promise<void> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('Account not found');
    if (user.isEmailVerified) {
      throw new BadRequestException('This account is already verified');
    }
    if (user.emailVerificationToken !== token) {
      throw new BadRequestException('Invalid or expired cancellation token');
    }
    await this.userModel.findByIdAndDelete(userId).exec();
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: dto }, { new: true })
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return this.toUserResponse(user);
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');
    user.settings = { ...(user.settings || {}), ...dto } as User['settings'];
    await user.save();
    return this.toUserResponse(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');
    const valid = await this.encryptionService.verify(user.passwordHash, currentPassword);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    const hash = await this.encryptionService.hash(newPassword);
    await this.userModel.findByIdAndUpdate(userId, { passwordHash: hash }).exec();
  }

  async listPublicDoctors(query: ListDoctorsQueryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    const and: Record<string, unknown>[] = [
      {
        $or: [
          { 'doctorProfile.status': { $in: [DoctorStatus.Approved, DoctorStatus.Active] } },
          {
            isEmailVerified: true,
            'doctorProfile.clinicName': { $exists: true, $ne: '' },
            'doctorProfile.status': DoctorStatus.PendingReview,
          },
        ],
      },
    ];
    if (query.specialty) {
      and.push({ 'doctorProfile.specialties': query.specialty });
    }
    if (query.search) {
      const r = new RegExp(escapeRegex(query.search), 'i');
      and.push({
        $or: [
          { name: r },
          { 'doctorProfile.clinicName': r },
          { 'doctorProfile.location': r },
        ],
      });
    }
    const match = { role: Role.Doctor, $and: and };
    const [rawItems, total] = await Promise.all([
      this.userModel
        .find(match)
        .select('name doctorProfile createdAt isEmailVerified')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.userModel.countDocuments(match),
    ]);
    const items = rawItems.map((doc) => ({
      id: String(doc._id),
      name: doc.name,
      doctorProfile: this.toDoctorProfileResponse(doc.doctorProfile as DoctorProfile),
      isEmailVerified: doc.isEmailVerified,
      createdAt: (doc as { createdAt?: Date }).createdAt,
    }));
    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getPublicDoctorById(doctorId: string) {
    if (!Types.ObjectId.isValid(doctorId)) {
      throw new NotFoundException('Doctor not found');
    }
    const doc = await this.userModel.findById(doctorId).lean().exec();
    if (!doc || doc.role !== Role.Doctor) {
      throw new NotFoundException('Doctor not found');
    }
    return {
      id: String(doc._id),
      name: doc.name,
      doctorProfile: this.toDoctorProfileResponse(doc.doctorProfile as DoctorProfile),
      isEmailVerified: doc.isEmailVerified,
      createdAt: (doc as { createdAt?: Date }).createdAt,
    };
  }

  async findAll(pagination: PaginationDto, role?: Role) {
    const { page = 1, limit = 10 } = pagination;
    const query = role ? { role } : {};
    const [items, total] = await Promise.all([
      this.userModel
        .find(query)
        .select('-passwordHash -passwordResetToken -resetUrlToken -emailVerificationToken -refreshToken')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.userModel.countDocuments(query),
    ]);
    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateDoctorStatus(doctorId: string, status: DoctorStatus) {
    const user = await this.userModel.findById(doctorId).exec();
    if (!user || user.role !== Role.Doctor) {
      throw new NotFoundException('Doctor not found');
    }
    user.doctorProfile = { ...(user.doctorProfile ?? {}), status };
    if (status === DoctorStatus.Approved || status === DoctorStatus.Active) {
      user.userState = UserAccountState.Active;
    }
    await user.save();
    return this.toUserResponse(user);
  }

  async updateUserState(userId: string, userState: UserAccountState) {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { userState }, { new: true })
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return this.toUserResponse(user);
  }

  toDoctorProfileResponse(ap?: DoctorProfile | null): DoctorProfileResponse | undefined {
    if (!ap) return undefined;
    return {
      clinicName: ap.clinicName,
      licenseNumber: ap.licenseNumber,
      location: ap.location,
      specialties: ap.specialties,
      speciesTreated: ap.speciesTreated,
      bio: ap.bio,
      isVerified: ap.isVerified,
      status: ap.status,
      documentUrls: ap.documentUrls,
      profileImageUrl: ap.profileImageUrl,
    };
  }

  toUserResponse(user: UserDocument): UserResponse {
    const base: UserResponse = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      userState: user.userState ?? UserAccountState.Active,
      isEmailVerified: user.isEmailVerified,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      farmName: user.farmName,
      farmLocation: user.farmLocation,
      farmSizeHectares: user.farmSizeHectares,
      assignedDoctorId: user.assignedDoctorId,
      settings: user.settings,
    };
    if (user.role === Role.Farmer && user.userFileUrls?.length) {
      base.userFileUrls = user.userFileUrls;
    }
    if (user.role === Role.Admin && user.adminFileUrls?.length) {
      base.adminFileUrls = user.adminFileUrls;
    }
    const doctorProfile = this.toDoctorProfileResponse(user.doctorProfile);
    return doctorProfile ? { ...base, doctorProfile } : base;
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
