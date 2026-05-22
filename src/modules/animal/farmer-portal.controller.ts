import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnimalService } from './animal.service';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, Roles } from '../../common/decorators/roles.decorator';
import { FarmerOverviewQueryDto } from './dto/farmer-overview-query.dto';

@ApiTags('Farmer Portal')
@ApiBearerAuth(SWAGGER_BEARER)
@Controller('farmer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Farmer)
export class FarmerPortalController {
  constructor(private readonly animalService: AnimalService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Farmer dashboard overview',
    description:
      'Figma Overview: total/healthy/sick livestock, veterinary visits, visit graph, livestock table. ?month=&year=',
  })
  getOverview(
    @CurrentUser('id') farmerId: string,
    @Query() period: FarmerOverviewQueryDto,
  ) {
    return this.animalService.getFarmerOverview(farmerId, period);
  }

  @Get('livestock/stats')
  @ApiOperation({ summary: 'Livestock summary cards' })
  getLivestockStats(@CurrentUser('id') farmerId: string) {
    return this.animalService.getFarmerLivestockStats(farmerId);
  }
}
