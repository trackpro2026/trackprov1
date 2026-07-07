import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { HealthRecordService } from '../health-record/health-record.service';
import { UserService } from '../user/user.service';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AdminListFarmersQueryDto } from './dto/admin-list-farmers-query.dto';
import { AdminListLivestockQueryDto } from './dto/admin-list-livestock-query.dto';
import { AdminListSlaughterhousesQueryDto } from './dto/admin-list-slaughterhouses-query.dto';
import { AdminListDoctorsQueryDto } from './dto/admin-list-doctors-query.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { UpdateDoctorStatusDto } from './dto/update-doctor-status.dto';

@ApiTags('Admin Portal')
@ApiBearerAuth(SWAGGER_BEARER)
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly healthRecordService: HealthRecordService,
    private readonly userService: UserService,
  ) {}

  @Get('me')
  @ApiOperation({
    summary: 'Admin profile (getMe)',
    description: 'Figma Profile + unreadNotificationCount for header bell badge.',
  })
  getMe(@CurrentUser('id') adminId: string) {
    return this.userService.findMe(adminId);
  }

  @Get('overview')
  @ApiOperation({
    summary: 'Admin dashboard overview',
    description:
      'Figma Overview: platform summary cards, livestock/visit stats, visits chart, recent visits table.',
  })
  overview() {
    return this.adminService.getOverview();
  }

  @Get('farmers/stats')
  @ApiOperation({
    summary: 'Farmer summary cards',
    description: 'totalFarmers, activeFarmers, suspendedFarmers, deactivatedFarmers',
  })
  farmerStats() {
    return this.adminService.getFarmerStats();
  }

  @Get('farmers')
  @ApiOperation({
    summary: 'Farmers list',
    description: 'Figma table: name, farmerId, livestockCount, location, phone. ?search=&userState=',
  })
  listFarmers(@Query() query: AdminListFarmersQueryDto) {
    return this.adminService.listFarmers(query);
  }

  @Get('farmers/:id')
  @ApiOperation({
    summary: 'Farmer detail',
    description: 'Personal info + livestockTable (type, obtainedBy, healthStatus, lastVeterinaryVisit).',
  })
  getFarmer(@Param('id') id: string) {
    return this.adminService.getFarmerDetail(id);
  }

  @Get('livestock/stats')
  @ApiOperation({ summary: 'Livestock summary cards (total / healthy / sick)' })
  livestockStats() {
    return this.adminService.getLivestockStats();
  }

  @Get('livestock')
  @ApiOperation({
    summary: 'Livestock list',
    description: 'Figma filters: species, healthStatus, obtainedBy, search.',
  })
  listLivestock(@Query() query: AdminListLivestockQueryDto) {
    return this.adminService.listLivestock(query);
  }

  @Get('livestock/:id')
  @ApiOperation({
    summary: 'Livestock detail',
    description: 'Visit graph, vet card, livestock info, veterinary visits table.',
  })
  getLivestock(@Param('id') id: string) {
    return this.adminService.getLivestockDetail(id);
  }

  @Get('slaughterhouses/stats')
  @ApiOperation({
    summary: 'Slaughterhouse summary cards',
    description: 'totalSlaughterhouses, totalVisits, totalLivestocks',
  })
  slaughterhouseStats() {
    return this.adminService.getSlaughterhouseStats();
  }

  @Get('slaughterhouses')
  @ApiOperation({
    summary: 'Slaughterhouses list',
    description: 'Figma: ID, location, visits, phone, nextScheduledVisit. ?status=&search=',
  })
  listSlaughterhouses(@Query() query: AdminListSlaughterhousesQueryDto) {
    return this.adminService.listSlaughterhouseFacilities(query);
  }

  @Get('slaughterhouses/:id')
  @ApiOperation({
    summary: 'Slaughterhouse detail',
    description: 'Facility info + livestockSlaughteredTable.',
  })
  getSlaughterhouse(@Param('id') id: string) {
    return this.adminService.getSlaughterhouseDetail(id);
  }

  @Get('veterinary-visits/stats')
  @ApiOperation({
    summary: 'Veterinary visit summary',
    description: 'totalVeterinaryVisits, totalLivestockChecked, totalVeterinarians',
  })
  visitStats() {
    return this.adminService.getVisitStats();
  }

  @Get('veterinary-visits')
  @ApiOperation({ summary: 'All veterinary visits (enriched table)' })
  listVisits(@Query() query: PaginationDto) {
    return this.healthRecordService.findAllEnriched(query);
  }

  @Get('veterinary-visits/:id')
  @ApiOperation({ summary: 'Veterinary visit detail (Figma drill-down)' })
  getVisit(@Param('id') id: string) {
    return this.healthRecordService.findOneDetailed(id, 'admin', Role.Admin);
  }

  @Get('doctors/stats')
  @ApiOperation({ summary: 'Veterinarian summary cards' })
  doctorStats() {
    return this.adminService.getDoctorStats();
  }

  @Get('doctors')
  @ApiOperation({
    summary: 'Veterinarians list',
    description: 'Figma: ID, name, visitCount, phone, lastVisit. ?status=&search=',
  })
  listDoctors(@Query() query: AdminListDoctorsQueryDto) {
    return this.adminService.listDoctors(query);
  }

  @Get('doctors/:id')
  @ApiOperation({ summary: 'Veterinarian detail with visit history' })
  getDoctor(@Param('id') id: string) {
    return this.adminService.getDoctorDetail(id);
  }

  @Get('slaughterhouse-operators')
  @ApiOperation({ summary: 'Slaughterhouse operator accounts' })
  listOperators(@Query() query: PaginationDto) {
    return this.adminService.listSlaughterhouseOperators(query);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Platform counts' })
  analytics() {
    return this.adminService.getAnalytics();
  }

  @Get('users/:id')
  getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update user account state (suspend / activate)' })
  updateUser(@Param('id') id: string, @Body() dto: UpdateAdminUserDto) {
    return this.adminService.updateUserByAdmin(id, dto);
  }

  @Patch('doctors/:id/status')
  @ApiOperation({ summary: 'Approve / decline veterinarian' })
  updateDoctorStatus(@Param('id') id: string, @Body() dto: UpdateDoctorStatusDto) {
    return this.adminService.updateDoctorStatus(id, dto.status);
  }

  @Post('users')
  createUser(@Body() dto: CreateUserDto, @Body('role') role?: Role) {
    return this.adminService.createUser(dto, role ?? Role.Farmer);
  }
}
