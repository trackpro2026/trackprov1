import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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
import { ScanLivestockQueryDto } from './dto/scan-livestock-query.dto';
import { RecordSlaughterDto } from './dto/record-slaughter.dto';
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

  @Get('me')
  @ApiOperation({
    summary: 'Slaughterhouse profile (getMe)',
    description:
      'Figma Profile: fullName, email, phone, profilePictureUrl, unreadNotificationCount, facility profile.',
  })
  getMe(@CurrentUser('id') operatorId: string) {
    return this.userService.findMe(operatorId);
  }

  @Get('overview')
  @ApiOperation({
    summary: 'Slaughterhouse dashboard overview',
    description:
      'Figma Overview: totalLivestockSlaughtered summary card + livestockSlaughteredTable (ID, type, obtainedBy, health, last vet visit).',
  })
  getOverview(@CurrentUser('id') operatorId: string) {
    return this.slaughterhouseService.getOperatorOverview(operatorId);
  }

  @Get('livestock/stats')
  @ApiOperation({ summary: 'Total livestock slaughtered (summary card)' })
  getLivestockStats(@CurrentUser('id') operatorId: string) {
    return this.slaughterhouseService.getSlaughterStats(operatorId);
  }

  @Get('livestock/scan')
  @ApiOperation({
    summary: 'Scan livestock for Add Slaughter',
    description:
      'Figma QR scan: pass ?qrPayload= or ?tagId= or ?animalId=. Returns livestock fields + canSlaughter flag.',
  })
  scanLivestock(@Query() query: ScanLivestockQueryDto) {
    return this.slaughterhouseService.scanLivestock(query);
  }

  @Post('livestock/slaughter')
  @ApiOperation({
    summary: 'Record slaughter (Save Slaughter)',
    description:
      'Figma Add Slaughter: requires healthy livestock. Blocks sick animals with validation message.',
  })
  recordSlaughter(
    @CurrentUser('id') operatorId: string,
    @Body() dto: RecordSlaughterDto,
  ) {
    return this.slaughterhouseService.recordSlaughter(operatorId, dto);
  }

  @Get('livestock')
  @ApiOperation({
    summary: 'Livestock slaughtered at your facility',
    description:
      'Figma table: livestockId, type, obtainedBy, healthStatus, lastVeterinaryVisit. Filters: species, healthStatus, obtainedBy, search.',
  })
  listLivestock(
    @CurrentUser('id') operatorId: string,
    @Query() query: ListOperatorLivestockQueryDto,
  ) {
    return this.slaughterhouseService.listOperatorLivestock(operatorId, query);
  }

  @Get('livestock/:id')
  @ApiOperation({
    summary: 'Slaughtered livestock detail',
    description:
      'Figma detail: livestock info, vet card, visit graph, veterinary visits table, slaughter record.',
  })
  getLivestockDetail(
    @CurrentUser('id') operatorId: string,
    @Param('id') animalId: string,
  ) {
    return this.slaughterhouseService.getSlaughteredLivestockDetail(operatorId, animalId);
  }

  @Get('records')
  @ApiOperation({
    summary: 'All slaughter records at your facility',
    description: 'Includes scheduled, in-progress, and completed bookings.',
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
