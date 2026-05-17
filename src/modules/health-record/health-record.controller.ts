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
import { HEALTH_RECORDS_TAG } from '../../common/swagger/api-descriptions';
import { CreateHealthRecordDto } from './dto/create-health-record.dto';
import { UpdateHealthRecordDto } from './dto/update-health-record.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Health Records')
@ApiBearerAuth(SWAGGER_BEARER)
@Controller('health-records')
@UseGuards(JwtAuthGuard)
export class HealthRecordController {
  constructor(private readonly healthRecordService: HealthRecordService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.Doctor)
  @ApiOperation({
    summary: 'Create health record',
    description: `${HEALTH_RECORDS_TAG}\n\n**Create** — Log a visit, vaccination, or treatment for an animal.`,
  })
  create(@Body() dto: CreateHealthRecordDto, @CurrentUser('id') doctorId: string) {
    return this.healthRecordService.create(dto, doctorId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.Doctor)
  @ApiOperation({
    summary: 'List my health records',
    description: '**Read (list)** — All records created by the logged-in veterinarian (paginated).',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  findMine(@Query() pagination: PaginationDto, @CurrentUser('id') doctorId: string) {
    return this.healthRecordService.findForDoctor(doctorId, pagination);
  }

  @Get('animal/:animalId')
  @ApiOperation({
    summary: 'List health records for an animal',
    description:
      '**Read (list by animal)** — Farmer (own animal), assigned doctor, or admin can view visit history for one animal.',
  })
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
    summary: 'Get health record by ID',
    description: '**Read (one)** — Single visit record. Farmer (own herd), creating doctor, or admin.',
  })
  @ApiParam({ name: 'id', description: 'MongoDB health record _id' })
  findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.healthRecordService.findOne(id, userId, role);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.Doctor, Role.Admin)
  @ApiOperation({
    summary: 'Update health record',
    description:
      '**Update** — Correct or extend a visit (diagnosis, treatment, follow-up date, etc.). Only the doctor who created the record, or admin.',
  })
  @ApiParam({ name: 'id', description: 'MongoDB health record _id' })
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
  @ApiOperation({
    summary: 'Delete health record',
    description: '**Delete** — Remove a visit record. Only the creating doctor or admin.',
  })
  @ApiParam({ name: 'id', description: 'MongoDB health record _id' })
  remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.healthRecordService.remove(id, userId, role);
  }
}
