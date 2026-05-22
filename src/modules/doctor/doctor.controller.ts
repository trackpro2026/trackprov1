import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserService } from '../user/user.service';
import { HealthRecordService } from '../health-record/health-record.service';
import { DoctorOverviewQueryDto } from '../health-record/dto/doctor-overview-query.dto';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, Roles } from '../../common/decorators/roles.decorator';
import { CompleteDoctorProfileDto } from '../user/dto/complete-doctor-profile.dto';

@ApiTags('Doctor')
@ApiBearerAuth(SWAGGER_BEARER)
@Controller('doctor')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Doctor)
export class DoctorController {
  constructor(
    private readonly userService: UserService,
    private readonly healthRecordService: HealthRecordService,
  ) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Veterinarian dashboard overview',
    description: 'Alias for GET /veterinary-visits/overview (Figma dashboard).',
  })
  getOverview(@CurrentUser('id') doctorId: string, @Query() period: DoctorOverviewQueryDto) {
    return this.healthRecordService.getDoctorOverview(doctorId, period);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Visit type & monthly charts (Figma)' })
  getAnalytics(@CurrentUser('id') doctorId: string, @Query('months') months?: string) {
    const n = months ? parseInt(months, 10) : 6;
    return this.healthRecordService.getDoctorAnalytics(doctorId, Number.isFinite(n) ? n : 6);
  }

  @Patch('profile')
  completeProfile(
    @CurrentUser('id') doctorId: string,
    @Body() dto: CompleteDoctorProfileDto,
  ) {
    return this.userService.completeDoctorProfile(doctorId, dto);
  }
}
