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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, Roles } from '../../common/decorators/roles.decorator';

/** Figma-aligned path alias — same handlers as `/health-records`. */
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
    description: `${VETERINARY_VISITS_TAG}\n\nAlias of \`POST /health-records\`.`,
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
  findMine(@Query() pagination: PaginationDto, @CurrentUser('id') doctorId: string) {
    return this.healthRecordService.findForDoctor(doctorId, pagination);
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
  @ApiOperation({ summary: 'Get veterinary visit by ID' })
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
