import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { DashboardService } from './dashboard.service';
import { Animal } from '../animal/entities/animal.entity';
import { HealthRecord } from '../health-record/entities/health-record.entity';
import { TrackingEvent } from '../tracking/entities/tracking-event.entity';
import { User } from '../user/entities/user.entity';
import { AnimalService } from '../animal/animal.service';

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: AnimalService,
          useValue: {
            getStatsForFarmer: jest.fn().mockResolvedValue({
              totalActive: 3,
              bySpecies: { cattle: 2 },
              byHealthStatus: { healthy: 3 },
            }),
          },
        },
        {
          provide: getModelToken(Animal.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              lean: jest.fn().mockResolvedValue([]),
            }),
            countDocuments: jest.fn().mockResolvedValue(0),
            distinct: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getModelToken(HealthRecord.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              lean: jest.fn().mockResolvedValue([]),
            }),
          },
        },
        {
          provide: getModelToken(TrackingEvent.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              lean: jest.fn().mockResolvedValue([]),
            }),
          },
        },
        {
          provide: getModelToken(User.name),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('getFarmerDashboard returns herd summary', async () => {
    const result = await service.getFarmerDashboard(new Types.ObjectId().toString());
    expect(result.animalStats.totalActive).toBe(3);
    expect(result.recentAnimals).toEqual([]);
  });

  it('getDoctorDashboard returns assigned animals', async () => {
    const result = await service.getDoctorDashboard(new Types.ObjectId().toString());
    expect(result.assignedAnimalCount).toBe(0);
    expect(result.recentHealthRecords).toEqual([]);
  });
});
