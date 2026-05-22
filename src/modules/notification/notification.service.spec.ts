import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotificationService } from './notification.service';
import { Notification } from './entities/notification.entity';
import { User } from '../user/entities/user.entity';

describe('NotificationService', () => {
  let service: NotificationService;
  const create = jest.fn().mockResolvedValue({ _id: 'n1' });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getModelToken(Notification.name),
          useValue: { create, find: jest.fn(), countDocuments: jest.fn() },
        },
        {
          provide: getModelToken(User.name),
          useValue: {
            find: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) }) }),
          },
        },
      ],
    }).compile();

    service = module.get(NotificationService);
    create.mockClear();
  });

  it('notify creates a record', async () => {
    const userId = '507f1f77bcf86cd799439011';
    await service.notify(userId, { title: 'T', message: 'M' });
    expect(create).toHaveBeenCalled();
  });

  it('notify swallows errors', async () => {
    const userId = '507f1f77bcf86cd799439011';
    create.mockRejectedValueOnce(new Error('db down'));
    await expect(service.notify(userId, { title: 'T', message: 'M' })).resolves.toBeUndefined();
  });
});
