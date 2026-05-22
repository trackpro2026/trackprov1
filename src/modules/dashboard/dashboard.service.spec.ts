import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { DashboardService } from './dashboard.service';
import { Animal } from '../animal/entities/animal.entity';
import { HealthRecord } from '../health-record/entities/health-record.entity';
import { User } from '../user/entities/user.entity';
import { AnimalService } from '../animal/animal.service';
import { HealthRecordService } from '../health-record/health-record.service';
import { SlaughterhouseService } from '../slaughterhouse/slaughterhouse.service';

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: AnimalService,
          useValue: {
            getFarmerOverview: jest.fn().mockResolvedValue({
              totalLivestock: 3,
              healthyLivestock: 2,
              sickLivestock: 1,
              livestockTable: [],
              visitsByMonth: [],
            }),
            getStatsForFarmer: jest.fn().mockResolvedValue({
              totalActive: 3,
              bySpecies: { cattle: 2 },
              byHealthStatus: { healthy: 3 },
            }),
          },
        },
        {
          provide: HealthRecordService,
          useValue: {
            getDoctorOverview: jest.fn().mockResolvedValue({
              totalVisits: 0,
              pendingVisits: 0,
              recentVeterinaryVisits: [],
            }),
            getDoctorVisitStats: jest.fn().mockResolvedValue({
              totalVisits: 0,
              pendingVisits: 0,
              totalFarmers: 0,
              totalLivestock: 0,
            }),
            findForDoctor: jest.fn().mockResolvedValue({ items: [], meta: {} }),
          },
        },
        {
          provide: SlaughterhouseService,
          useValue: { listFacilities: jest.fn().mockResolvedValue([]) },
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
            aggregate: jest.fn().mockResolvedValue([]),
            distinct: jest.fn().mockResolvedValue([]),
          },
        },
        // getDoctorDashboard also queries assigned animals
        {
          provide: getModelToken(HealthRecord.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              lean: jest.fn().mockResolvedValue([]),
            }),
            countDocuments: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: getModelToken(User.name),
          useValue: { countDocuments: jest.fn().mockResolvedValue(0) },
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('getFarmerDashboard returns herd summary', async () => {
    const result = await service.getFarmerDashboard(new Types.ObjectId().toString());
    expect(result.totalLivestock).toBe(3);
    expect(result.livestockTable).toEqual([]);
  });

  it('getDoctorDashboard returns visit summary', async () => {
    const result = await service.getDoctorDashboard(new Types.ObjectId().toString());
    expect(result.totalVisits).toBe(0);
    expect(result.recentVeterinaryVisits).toEqual([]);
  });
});
