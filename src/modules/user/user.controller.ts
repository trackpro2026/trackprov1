import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
import { USERS_TAG } from '../../common/swagger/api-descriptions';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('Users')
@ApiBearerAuth(SWAGGER_BEARER)
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get my profile',
    description: `${USERS_TAG}\n\n**Read** — Current user (farmer farm fields or doctor profile).`,
  })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.userService.findById(userId);
  }

  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Get user by ID (public)',
    description: '**Read** — Basic public user info by MongoDB _id.',
  })
  async getUserById(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update my profile',
    description:
      '**Update** — Name, phone, farmName, farmLocation, farmSizeHectares, assignedDoctorId (farmers).',
  })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(userId, dto);
  }

  @Patch('me/settings')
  @ApiOperation({
    summary: 'Update notification settings',
    description: '**Update** — emailNotifications, pushNotifications, healthAlerts, language, timezone.',
  })
  async updateSettings(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.userService.updateSettings(userId, dto);
  }

  @Patch('me/password')
  @ApiOperation({
    summary: 'Change password',
    description: '**Update** — Requires current password.',
  })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.userService.changePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
    );
    return { message: 'Password updated successfully' };
  }
}
