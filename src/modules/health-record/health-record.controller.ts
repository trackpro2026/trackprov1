import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HealthRecordService } from './health-record.service';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
import { CreateHealthRecordDto } from './dto/create-health-record.dto';
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
  create(@Body() dto: CreateHealthRecordDto, @CurrentUser('id') doctorId: string) {
    return this.healthRecordService.create(dto, doctorId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.Doctor)
  findMine(@Query() pagination: PaginationDto, @CurrentUser('id') doctorId: string) {
    return this.healthRecordService.findForDoctor(doctorId, pagination);
  }

  @Get('animal/:animalId')
  findForAnimal(
    @Param('animalId') animalId: string,
    @Query() pagination: PaginationDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.healthRecordService.findForAnimal(animalId, userId, role, pagination);
  }
}
