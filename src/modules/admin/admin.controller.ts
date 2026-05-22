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
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/decorators/roles.decorator';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { UpdateDoctorStatusDto } from './dto/update-doctor-status.dto';

@ApiTags('Admin')
@ApiBearerAuth(SWAGGER_BEARER)
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly healthRecordService: HealthRecordService,
  ) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Admin dashboard overview',
    description:
      'Figma Overview: summary cards, healthy/sick livestock, visit stats, year chart, recent visits.',
  })
  overview() {
    return this.adminService.getOverview();
  }

  @Get('livestock/stats')
  @ApiOperation({ summary: 'Livestock summary cards (total / healthy / sick)' })
  livestockStats() {
    return this.adminService.getLivestockStats();
  }

  @Get('livestock')
  @ApiOperation({ summary: 'Admin livestock list (Figma Livestocks)' })
  listLivestock(@Query() query: PaginationDto) {
    return this.adminService.listLivestock(query);
  }

  @Get('livestock/:id')
  @ApiOperation({ summary: 'Livestock detail with owner and visit history' })
  getLivestock(@Param('id') id: string) {
    return this.adminService.getLivestockDetail(id);
  }

  @Get('veterinary-visits/stats')
  @ApiOperation({ summary: 'Veterinary visit summary (total / completed / pending)' })
  visitStats() {
    return this.adminService.getVisitStats();
  }

  @Get('veterinary-visits')
  @ApiOperation({ summary: 'Admin veterinary visits list' })
  listVisits(@Query() query: PaginationDto) {
    return this.healthRecordService.findAllEnriched(query);
  }

  @Get('veterinary-visits/:id')
  @ApiOperation({ summary: 'Veterinary visit detail (Figma drill-down)' })
  getVisit(@Param('id') id: string) {
    return this.healthRecordService.findOneDetailed(id, 'admin', Role.Admin);
  }

  @Get('slaughterhouses')
  @ApiOperation({ summary: 'Admin slaughterhouses list with active/inactive summary' })
  listSlaughterhouses(@Query() query: PaginationDto) {
    return this.adminService.listSlaughterhouseFacilities(query);
  }

  @Get('slaughterhouses/:id')
  @ApiOperation({ summary: 'Slaughterhouse detail with recent slaughtered livestock' })
  getSlaughterhouse(@Param('id') id: string) {
    return this.adminService.getSlaughterhouseDetail(id);
  }

  @Get('slaughterhouse-operators')
  @ApiOperation({ summary: 'Admin slaughterhouse operator accounts' })
  listOperators(@Query() query: PaginationDto) {
    return this.adminService.listSlaughterhouseOperators(query);
  }

  @Get('farmers')
  @ApiOperation({ summary: 'Farmers list with livestock count' })
  listFarmers(@Query() query: PaginationDto) {
    return this.adminService.listFarmers(query);
  }

  @Get('farmers/:id')
  @ApiOperation({ summary: 'Farmer detail with livestock table' })
  getFarmer(@Param('id') id: string) {
    return this.adminService.getFarmerDetail(id);
  }

  @Get('doctors')
  @ApiOperation({ summary: 'Veterinarians list with status and last visit' })
  listDoctors(@Query() query: PaginationDto) {
    return this.adminService.listDoctors(query);
  }

  @Get('doctors/:id')
  @ApiOperation({ summary: 'Veterinarian detail with visit history' })
  getDoctor(@Param('id') id: string) {
    return this.adminService.getDoctorDetail(id);
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
  @ApiOperation({ summary: 'Update user account state' })
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
