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
import { TrackingService } from './tracking.service';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
import { TRACKING_TAG } from '../../common/swagger/api-descriptions';
import { CreateTrackingEventDto } from './dto/create-tracking-event.dto';
import { UpdateTrackingEventDto } from './dto/update-tracking-event.dto';
import { ListTrackingQueryDto } from './dto/list-tracking-query.dto';
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
  @ApiOperation({
    summary: 'Create tracking event',
    description: `${TRACKING_TAG}\n\n**Create** — Log weight, location, feeding, or movement. Type \`weight\` also updates the animal’s \`weightKg\`.`,
  })
  create(@Body() dto: CreateTrackingEventDto, @CurrentUser('id') farmerId: string) {
    return this.trackingService.create(dto, farmerId);
  }

  @Get()
  @ApiOperation({
    summary: 'List tracking events',
    description:
      '**Read (list)** — All events on your farm. Optional `animalId` query to filter one animal.',
  })
  @ApiQuery({ name: 'animalId', required: false, description: 'Filter by animal' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  findAll(@Query() query: ListTrackingQueryDto, @CurrentUser('id') farmerId: string) {
    return this.trackingService.findForFarmer(farmerId, query);
  }

  @Get('animal/:animalId')
  @ApiOperation({
    summary: 'List events for one animal',
    description: '**Read (list by animal)** — Chronological weight/location/feeding history for a single animal.',
  })
  @ApiParam({ name: 'animalId', description: 'MongoDB animal _id' })
  findForAnimal(
    @Param('animalId') animalId: string,
    @Query() query: ListTrackingQueryDto,
    @CurrentUser('id') farmerId: string,
  ) {
    return this.trackingService.findForAnimal(animalId, farmerId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get tracking event by ID',
    description: '**Read (one)** — Single log entry (must belong to your farm).',
  })
  @ApiParam({ name: 'id', description: 'MongoDB tracking event _id' })
  findOne(@Param('id') id: string, @CurrentUser('id') farmerId: string) {
    return this.trackingService.findOne(id, farmerId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update tracking event',
    description:
      '**Update** — Fix timestamp, weight, location, or notes. If type is weight and weightKg is set, animal weight is updated.',
  })
  @ApiParam({ name: 'id', description: 'MongoDB tracking event _id' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTrackingEventDto,
    @CurrentUser('id') farmerId: string,
  ) {
    return this.trackingService.update(id, dto, farmerId);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete tracking event',
    description: '**Delete** — Remove a log entry from history (does not revert animal weight).',
  })
  @ApiParam({ name: 'id', description: 'MongoDB tracking event _id' })
  remove(@Param('id') id: string, @CurrentUser('id') farmerId: string) {
    return this.trackingService.remove(id, farmerId);
  }
}
