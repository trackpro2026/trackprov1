import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserService } from '../user/user.service';
import { SlaughterhouseService } from './slaughterhouse.service';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, Roles } from '../../common/decorators/roles.decorator';
import { CompleteSlaughterhouseProfileDto } from '../user/dto/complete-slaughterhouse-profile.dto';
import { ListOperatorLivestockQueryDto } from './dto/list-operator-livestock-query.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Slaughterhouse Portal')
@ApiBearerAuth(SWAGGER_BEARER)
@Controller('slaughterhouse')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Slaughterhouse)
export class SlaughterhousePortalController {
  constructor(
    private readonly userService: UserService,
    private readonly slaughterhouseService: SlaughterhouseService,
  ) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Slaughterhouse dashboard overview',
    description:
      'Figma Overview: process alerts, animals registered table, cattle/goat counts, recent slaughtered.',
  })
  getOverview(@CurrentUser('id') operatorId: string) {
    return this.slaughterhouseService.getOperatorOverview(operatorId);
  }

  @Get('livestock')
  @ApiOperation({
    summary: 'Animals registered at your facility',
    description:
      'Figma livestock table: ID, type, breed, health status, registered by, last vet visit. Optional ?species= filter.',
  })
  listLivestock(
    @CurrentUser('id') operatorId: string,
    @Query() query: ListOperatorLivestockQueryDto,
  ) {
    const { species, page, limit } = query;
    return this.slaughterhouseService.listOperatorLivestock(
      operatorId,
      { page, limit },
      species,
    );
  }

  @Get('records')
  @ApiOperation({
    summary: 'Slaughter records at your facility',
    description: 'All bookings scheduled at the operator’s linked facility.',
  })
  listRecords(@CurrentUser('id') operatorId: string, @Query() pagination: PaginationDto) {
    return this.slaughterhouseService.findRecords(
      operatorId,
      Role.Slaughterhouse,
      pagination,
    );
  }

  @Patch('profile')
  @ApiOperation({
    summary: 'Complete slaughterhouse operator profile',
    description: 'Figma: Profile + document settings. Creates/links facility record.',
  })
  async completeProfile(
    @CurrentUser('id') operatorId: string,
    @Body() dto: CompleteSlaughterhouseProfileDto,
  ) {
    const user = await this.userService.completeSlaughterhouseProfile(operatorId, dto);
    const facility = await this.slaughterhouseService.linkFacilityForOperator(operatorId, dto);
    return { user, facility };
  }
}
