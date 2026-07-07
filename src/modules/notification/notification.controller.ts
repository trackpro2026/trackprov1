import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Notifications')
@ApiBearerAuth(SWAGGER_BEARER)
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({
    summary: 'List my notifications',
    description:
      'Figma Notification Management: groupedByDate (Today, Yesterday), relativeTime, unreadCount. All roles.',
  })
  list(@CurrentUser('id') userId: string, @Query() pagination: PaginationDto) {
    return this.notificationService.listForUser(userId, pagination);
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Unread notification count',
    description: 'For header bell badge on farmer, vet, slaughterhouse, and admin dashboards.',
  })
  unreadCount(@CurrentUser('id') userId: string) {
    return this.notificationService.countUnread(userId).then((count) => ({ unreadCount: count }));
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentUser('id') userId: string) {
    return this.notificationService.markAllRead(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  markRead(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.notificationService.markRead(id, userId);
  }
}
