import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './entities/notification.entity';
import { User, UserDocument } from '../user/entities/user.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { NotificationType } from './notification.constants';
import { Role } from '../../common/decorators/roles.decorator';

export type CreateNotificationPayload = {
  title: string;
  message: string;
  type?: NotificationType | string;
  relatedId?: string;
  relatedType?: string;
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async createForUser(userId: string, payload: CreateNotificationPayload) {
    return this.notificationModel.create({
      userId: new Types.ObjectId(userId),
      title: payload.title,
      message: payload.message,
      type: payload.type ?? NotificationType.General,
      relatedId: payload.relatedId,
      relatedType: payload.relatedType,
    });
  }

  /** Notify every admin account (Figma: New farmer / vet / slaughterhouse alerts). */
  async notifyAdmins(payload: CreateNotificationPayload): Promise<void> {
    const admins = await this.userModel.find({ role: Role.Admin }).select('_id').lean().exec();
    await Promise.all(admins.map((a) => this.notify(String(a._id), payload)));
  }

  /** Fire-and-forget: never fails the calling business operation. */
  async notify(userId: string, payload: CreateNotificationPayload): Promise<void> {
    if (!userId) return;
    try {
      await this.createForUser(userId, payload);
    } catch (err) {
      this.logger.warn(`Failed to notify user ${userId}: ${(err as Error).message}`);
    }
  }

  async listForUser(userId: string, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const filter = { userId: new Types.ObjectId(userId) };
    const [items, total, unreadCount] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.notificationModel.countDocuments(filter),
      this.notificationModel.countDocuments({ ...filter, read: false }),
    ]);
    return {
      items,
      unreadCount,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async markRead(id: string, userId: string) {
    const updated = await this.notificationModel
      .findOneAndUpdate(
        { _id: id, userId: new Types.ObjectId(userId) },
        { $set: { read: true } },
        { new: true },
      )
      .lean();
    if (!updated) throw new NotFoundException('Notification not found');
    return updated;
  }

  async markAllRead(userId: string) {
    await this.notificationModel
      .updateMany({ userId: new Types.ObjectId(userId), read: false }, { $set: { read: true } })
      .exec();
    return { message: 'All notifications marked as read' };
  }
}
