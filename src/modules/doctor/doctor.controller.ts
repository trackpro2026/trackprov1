import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserService } from '../user/user.service';
import { HealthRecordService } from '../health-record/health-record.service';
import { DoctorOverviewQueryDto } from '../health-record/dto/doctor-overview-query.dto';
import { ScanLivestockForVisitQueryDto } from '../health-record/dto/scan-livestock-for-visit-query.dto';
import { RecordVeterinaryVisitDto } from '../health-record/dto/record-veterinary-visit.dto';
import { ListVisitsQueryDto } from '../health-record/dto/list-visits-query.dto';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, Roles } from '../../common/decorators/roles.decorator';
import { CompleteDoctorProfileDto } from '../user/dto/complete-doctor-profile.dto';

@ApiTags('Veterinarian Portal')
@ApiBearerAuth(SWAGGER_BEARER)
@Controller('doctor')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Doctor)
export class DoctorController {
  constructor(
    private readonly userService: UserService,
    private readonly healthRecordService: HealthRecordService,
  ) {}

  @Get('me')
  @ApiOperation({
    summary: 'Veterinarian profile (getMe)',
    description:
      'Figma Profile: fullName, email, phone, profilePictureUrl, unreadNotificationCount, doctorProfile.',
  })
  getMe(@CurrentUser('id') doctorId: string) {
    return this.userService.findMe(doctorId);
  }

  @Get('overview')
  @ApiOperation({
    summary: 'Veterinarian dashboard overview',
    description:
      'Figma Overview: summaryCards (totalVisits, slaughterhousesVisited, healthy/sick animals), veterinaryVisitsTable. ?month=&year=',
  })
  getOverview(@CurrentUser('id') doctorId: string, @Query() period: DoctorOverviewQueryDto) {
    return this.healthRecordService.getDoctorOverview(doctorId, period);
  }

  @Get('visits/stats')
  @ApiOperation({ summary: 'Overview summary cards' })
  getVisitStats(@CurrentUser('id') doctorId: string) {
    return this.healthRecordService.getDoctorVisitStats(doctorId);
  }

  @Get('visits')
  @ApiOperation({
    summary: 'List veterinary visits',
    description: 'Figma visits table: ID, livestockId, veterinarian, summary, dateTime. ?search=',
  })
  listVisits(@CurrentUser('id') doctorId: string, @Query() query: ListVisitsQueryDto) {
    const { search, page, limit } = query;
    return this.healthRecordService.findForDoctor(doctorId, { page, limit }, search);
  }

  @Get('visits/:id')
  @ApiOperation({
    summary: 'Veterinary visit detail',
    description: 'Figma detail: visit type, health ring, visit graph, livestock info, summary.',
  })
  getVisitDetail(@CurrentUser('id') doctorId: string, @Param('id') visitId: string) {
    return this.healthRecordService.findOneDetailed(visitId, doctorId, Role.Doctor);
  }

  @Get('livestock/scan')
  @ApiOperation({
    summary: 'Scan livestock for Add Visit',
    description: 'Figma QR scan: ?qrPayload= or ?tagId= or ?animalId=. Returns livestock + canRecordVisit.',
  })
  scanLivestock(
    @CurrentUser('id') doctorId: string,
    @Query() query: ScanLivestockForVisitQueryDto,
  ) {
    return this.healthRecordService.scanLivestockForVisit(doctorId, query);
  }

  @Post('visits')
  @ApiOperation({
    summary: 'Record visit (Submit Result)',
    description: 'Figma Add Visit: summary, healthStatus, visitDate. Updates livestock health when provided.',
  })
  recordVisit(@CurrentUser('id') doctorId: string, @Body() dto: RecordVeterinaryVisitDto) {
    return this.healthRecordService.recordVisit(doctorId, dto);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Visit type & monthly charts (Figma)' })
  getAnalytics(@CurrentUser('id') doctorId: string, @Query('months') months?: string) {
    const n = months ? parseInt(months, 10) : 6;
    return this.healthRecordService.getDoctorAnalytics(doctorId, Number.isFinite(n) ? n : 6);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Complete veterinarian profile' })
  completeProfile(
    @CurrentUser('id') doctorId: string,
    @Body() dto: CompleteDoctorProfileDto,
  ) {
    return this.userService.completeDoctorProfile(doctorId, dto);
  }
}
