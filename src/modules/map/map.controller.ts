import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MapService } from './map.service';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/decorators/roles.decorator';

@ApiTags('Map')
@ApiBearerAuth(SWAGGER_BEARER)
@Controller('map')
@UseGuards(JwtAuthGuard)
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Get('markers')
  @ApiOperation({
    summary: 'Map markers by role',
    description:
      'Figma Map screens: farmers, livestock pens, and slaughterhouse pins. Set latitude/longitude on profiles for coordinates.',
  })
  markers(@CurrentUser('id') userId: string, @CurrentUser('role') role: Role) {
    return this.mapService.getMarkers(userId, role);
  }
}
