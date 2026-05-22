import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { HealthRecordService } from './health-record.service';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
import { VETERINARY_VISITS_TAG } from '../../common/swagger/api-descriptions';
import { CreateHealthRecordDto } from './dto/create-health-record.dto';
import { UpdateHealthRecordDto } from './dto/update-health-record.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ListVisitsQueryDto } from './dto/list-visits-query.dto';
import { DoctorOverviewQueryDto } from './dto/doctor-overview-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Veterinary Visits')
@ApiBearerAuth(SWAGGER_BEARER)
@Controller('veterinary-visits')
@UseGuards(JwtAuthGuard)
export class VeterinaryVisitsController {
  constructor(private readonly healthRecordService: HealthRecordService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.Doctor)
  @ApiOperation({
    summary: 'Log veterinary visit',
    description: VETERINARY_VISITS_TAG,
  })
  create(@Body() dto: CreateHealthRecordDto, @CurrentUser('id') doctorId: string) {
    return this.healthRecordService.create(dto, doctorId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.Doctor)
  @ApiOperation({ summary: 'List my veterinary visits' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'search', required: false, description: 'Farmer name, tag ID, or reason' })
  findMine(@Query() query: ListVisitsQueryDto, @CurrentUser('id') doctorId: string) {
    const { search, page, limit } = query;
    return this.healthRecordService.findForDoctor(doctorId, { page, limit }, search);
  }

  @Get('overview')
  @UseGuards(RolesGuard)
  @Roles(Role.Doctor)
  @ApiOperation({
    summary: 'Veterinarian dashboard overview',
    description:
      'Figma Overview cards + visits table: totalVisits, slaughterhousesVisited, healthy/sick animals, ?month=&year=',
  })
  overview(@CurrentUser('id') doctorId: string, @Query() period: DoctorOverviewQueryDto) {
    return this.healthRecordService.getDoctorOverview(doctorId, period);
  }

  @Get('analytics')
  @UseGuards(RolesGuard)
  @Roles(Role.Doctor)
  @ApiOperation({
    summary: 'Visit analytics',
    description: 'Figma charts: visit type breakdown (donut) and visits by month (bar).',
  })
  @ApiQuery({ name: 'months', required: false, example: 6 })
  analytics(@CurrentUser('id') doctorId: string, @Query('months') months?: string) {
    const n = months ? parseInt(months, 10) : 6;
    return this.healthRecordService.getDoctorAnalytics(doctorId, Number.isFinite(n) ? n : 6);
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles(Role.Doctor)
  @ApiOperation({
    summary: 'Veterinarian visit stats (summary)',
    description: 'Shortcut stats for overview cards.',
  })
  visitStats(@CurrentUser('id') doctorId: string) {
    return this.healthRecordService.getDoctorVisitStats(doctorId);
  }

  @Get('animal/:animalId')
  @ApiOperation({ summary: 'Visit history for one animal' })
  @ApiParam({ name: 'animalId', description: 'MongoDB animal _id' })
  findForAnimal(
    @Param('animalId') animalId: string,
    @Query() pagination: PaginationDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.healthRecordService.findForAnimal(animalId, userId, role, pagination);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get veterinary visit by ID',
    description: 'Figma visit detail: livestock, owner, and veterinarian cards.',
  })
  findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.healthRecordService.findOneDetailed(id, userId, role);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.Doctor, Role.Admin)
  @ApiOperation({ summary: 'Update veterinary visit' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHealthRecordDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.healthRecordService.update(id, dto, userId, role);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.Doctor, Role.Admin)
  @ApiOperation({ summary: 'Delete veterinary visit' })
  remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.healthRecordService.remove(id, userId, role);
  }
}
