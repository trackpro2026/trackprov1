import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { EncryptionService } from '../../core/encryption/encryption.service';
import { Role } from '../../common/decorators/roles.decorator';
import { DoctorStatus } from './entities/doctor-profile.schema';

describe('UserService', () => {
  let service: UserService;
  let mockUserModel: {
    findOne: jest.Mock;
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    findOneAndUpdate: jest.Mock;
    find: jest.Mock;
    countDocuments: jest.Mock;
    prototype: { save: jest.Mock };
  };

  const savedUser = {
    _id: 'uid1',
    name: 'Test',
    email: 'test@example.com',
    role: Role.Farmer,
    passwordHash: 'hash',
    userState: 'active',
    save: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const chain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
      select: jest.fn().mockReturnThis(),
    };
    mockUserModel = {
      findOne: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(savedUser) }),
      findByIdAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(savedUser) }),
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(savedUser) }),
      find: jest.fn().mockReturnValue(chain),
      countDocuments: jest.fn().mockResolvedValue(0),
      prototype: { save: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        {
          provide: EncryptionService,
          useValue: {
            hash: jest.fn().mockResolvedValue('hashed'),
            verify: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a new farmer', async () => {
      const ctorSave = jest.fn().mockResolvedValue(savedUser);
      mockUserModel.prototype.save = ctorSave;

      const UserModelCtor = jest.fn().mockImplementation((data) => ({
        ...data,
        save: ctorSave,
      }));
      (service as unknown as { userModel: typeof mockUserModel }).userModel =
        Object.assign(UserModelCtor, mockUserModel);

      const result = await service.create(
        { name: 'A', email: 'a@example.com', password: 'pass' },
        Role.Farmer,
      );
      expect(result.email).toBe('test@example.com');
    });

    it('throws on duplicate email', async () => {
      mockUserModel.findOne.mockResolvedValue({ email: 'dup@example.com' });
      await expect(
        service.create({ name: 'A', email: 'dup@example.com', password: 'pass' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findById', () => {
    it('throws when not found', async () => {
      mockUserModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('completeDoctorProfile', () => {
    it('throws for non-doctor', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...savedUser, role: Role.Farmer }),
      });
      await expect(
        service.completeDoctorProfile('uid1', { clinicName: 'Farm Vet' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('updates doctor profile', async () => {
      const doctor = {
        ...savedUser,
        role: Role.Doctor,
        doctorProfile: { status: DoctorStatus.PendingReview },
        save: jest.fn().mockResolvedValue(true),
      };
      mockUserModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(doctor) });
      const result = await service.completeDoctorProfile('uid1', {
        clinicName: 'Rural Vet Clinic',
        specialties: ['cattle'],
      });
      expect(doctor.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });
});
