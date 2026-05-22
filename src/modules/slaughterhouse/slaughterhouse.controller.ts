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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SlaughterhouseService } from './slaughterhouse.service';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
import { SLAUGHTERHOUSE_TAG } from '../../common/swagger/api-descriptions';
import {
  CreateSlaughterhouseDto,
  CreateSlaughterRecordDto,
  UpdateSlaughterhouseDto,
  UpdateSlaughterRecordDto,
} from './dto/slaughterhouse.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Slaughterhouse')
@Controller('slaughterhouses')
export class SlaughterhouseFacilitiesController {
  constructor(private readonly slaughterhouseService: SlaughterhouseService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List approved slaughterhouse facilities',
    description: `${SLAUGHTERHOUSE_TAG}\n\nPublic directory of approved abattoirs.`,
  })
  listApproved() {
    return this.slaughterhouseService.listFacilities(false);
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth(SWAGGER_BEARER)
  @ApiOperation({ summary: 'List all slaughterhouse facilities (admin)' })
  listAll() {
    return this.slaughterhouseService.listFacilities(true);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth(SWAGGER_BEARER)
  @ApiOperation({ summary: 'Register a slaughterhouse facility (admin)' })
  create(@Body() dto: CreateSlaughterhouseDto) {
    return this.slaughterhouseService.createFacility(dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(SWAGGER_BEARER)
  @ApiOperation({ summary: 'Get slaughterhouse facility by ID' })
  getOne(@Param('id') id: string) {
    return this.slaughterhouseService.getFacility(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth(SWAGGER_BEARER)
  @ApiOperation({ summary: 'Update slaughterhouse facility (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateSlaughterhouseDto) {
    return this.slaughterhouseService.updateFacility(id, dto);
  }
}

@ApiTags('Slaughterhouse')
@ApiBearerAuth(SWAGGER_BEARER)
@Controller('slaughter-records')
@UseGuards(JwtAuthGuard)
export class SlaughterRecordsController {
  constructor(private readonly slaughterhouseService: SlaughterhouseService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.Farmer)
  @ApiOperation({
    summary: 'Schedule animal for slaughter',
    description: 'Farmer schedules livestock at an approved slaughterhouse facility.',
  })
  create(@Body() dto: CreateSlaughterRecordDto, @CurrentUser('id') farmerId: string) {
    return this.slaughterhouseService.createRecord(dto, farmerId);
  }

  @Get()
  @ApiOperation({
    summary: 'List slaughter records',
    description:
      'Farmers: own records. Slaughterhouse: facility bookings. Doctors & admins: all records.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  findAll(
    @Query() pagination: PaginationDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.slaughterhouseService.findRecords(userId, role, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get slaughter record by ID' })
  findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.slaughterhouseService.findOneRecord(id, userId, role);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.Slaughterhouse, Role.Doctor, Role.Admin, Role.Farmer)
  @ApiOperation({
    summary: 'Update slaughter record',
    description:
      'Slaughterhouse: inspection & processing at own facility. Doctors: inspection. Farmers: cancel only. Admins: full.',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSlaughterRecordDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.slaughterhouseService.updateRecord(id, dto, userId, role);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.Farmer, Role.Admin)
  @ApiOperation({ summary: 'Cancel / delete slaughter record' })
  remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.slaughterhouseService.removeRecord(id, userId, role);
  }
}
