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
    const enriched = items.map((n) => ({
      ...n,
      id: String(n._id),
      relativeTime: this.formatRelativeTime((n as { createdAt?: Date }).createdAt),
      groupLabel: this.groupLabelForDate((n as { createdAt?: Date }).createdAt),
    }));
    const groupedByDate = this.groupNotificationsByDate(enriched);
    return {
      items: enriched,
      groupedByDate,
      unreadCount,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  private groupLabelForDate(date?: Date): string {
    if (!date) return 'Earlier';
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const d = new Date(date);
    if (d >= startOfToday) return 'Today';
    if (d >= startOfYesterday) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  private groupNotificationsByDate(
    items: Array<{ groupLabel?: string } & Record<string, unknown>>,
  ) {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.groupLabel ?? 'Earlier';
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([label, groupItems]) => ({
      label,
      items: groupItems,
    }));
  }

  private formatRelativeTime(date?: Date): string {
    if (!date) return '';
    const ms = Date.now() - new Date(date).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}mins ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}hours ago`;
    const days = Math.floor(hours / 24);
    return `${days}days ago`;
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

  async countUnread(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      userId: new Types.ObjectId(userId),
      read: false,
    });
  }
}
