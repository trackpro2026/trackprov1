import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TrackingService } from './tracking.service';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
import { CreateTrackingEventDto } from './dto/create-tracking-event.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Tracking')
@ApiBearerAuth(SWAGGER_BEARER)
@Controller('tracking')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Farmer)
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post()
  create(@Body() dto: CreateTrackingEventDto, @CurrentUser('id') farmerId: string) {
    return this.trackingService.create(dto, farmerId);
  }

  @Get('animal/:animalId')
  findForAnimal(
    @Param('animalId') animalId: string,
    @Query() pagination: PaginationDto,
    @CurrentUser('id') farmerId: string,
  ) {
    return this.trackingService.findForAnimal(animalId, farmerId, pagination);
  }
}
