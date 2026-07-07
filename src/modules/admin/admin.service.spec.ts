import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AdminService } from './admin.service';
import { UserService } from '../user/user.service';
import { HealthRecordService } from '../health-record/health-record.service';
import { AnimalService } from '../animal/animal.service';
import { User } from '../user/entities/user.entity';
import { Animal } from '../animal/entities/animal.entity';
import { HealthRecord } from '../health-record/entities/health-record.entity';
import { Slaughterhouse } from '../slaughterhouse/entities/slaughterhouse.entity';
import { SlaughterRecord } from '../slaughterhouse/entities/slaughter-record.entity';
import { Role } from '../../common/decorators/roles.decorator';
import { DoctorStatus } from '../user/entities/doctor-profile.schema';

describe('AdminService', () => {
  let service: AdminService;
  let userService: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: UserService,
          useValue: {
            findAll: jest.fn().mockResolvedValue({ items: [], meta: {} }),
            findById: jest.fn(),
            create: jest.fn(),
            updateUserState: jest.fn(),
            updateDoctorStatus: jest.fn(),
          },
        },
        {
          provide: HealthRecordService,
          useValue: {
            findAllEnriched: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
            findForDoctor: jest.fn().mockResolvedValue({ items: [], meta: {} }),
          },
        },
        {
          provide: AnimalService,
          useValue: {
            findOneDetailedForSlaughterhouse: jest.fn().mockResolvedValue({ livestock: {} }),
          },
        },
        {
          provide: getModelToken(User.name),
          useValue: {
            countDocuments: jest.fn().mockResolvedValue(5),
            aggregate: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getModelToken(Animal.name),
          useValue: {
            countDocuments: jest.fn().mockResolvedValue(10),
            aggregate: jest.fn().mockResolvedValue([]),
            findById: jest.fn(),
          },
        },
        {
          provide: getModelToken(HealthRecord.name),
          useValue: {
            countDocuments: jest.fn().mockResolvedValue(2),
            distinct: jest.fn().mockResolvedValue([]),
            aggregate: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getModelToken(Slaughterhouse.name),
          useValue: {
            countDocuments: jest.fn().mockResolvedValue(1),
            aggregate: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getModelToken(SlaughterRecord.name),
          useValue: {
            countDocuments: jest.fn().mockResolvedValue(0),
            aggregate: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    userService = module.get<UserService>(UserService);
  });

  it('listFarmers returns paginated farmers', async () => {
    const result = await service.listFarmers({ page: 1, limit: 10 });
    expect(result.items).toEqual([]);
    expect(result.meta).toBeDefined();
  });

  it('getAnalytics aggregates counts', async () => {
    const analytics = await service.getAnalytics();
    expect(analytics).toEqual({
      farmers: 5,
      doctors: 5,
      animals: 10,
      healthRecords: 2,
      slaughterhouses: 1,
      slaughterRecords: 0,
    });
  });

  it('updateDoctorStatus delegates', async () => {
    await service.updateDoctorStatus('d1', DoctorStatus.Approved);
    expect(userService.updateDoctorStatus).toHaveBeenCalledWith('d1', DoctorStatus.Approved);
  });

  it('updateUserByAdmin updates user state', async () => {
    await service.updateUserByAdmin('u1', { userState: 'active' as never });
    expect(userService.updateUserState).toHaveBeenCalledWith('u1', 'active');
  });
});
