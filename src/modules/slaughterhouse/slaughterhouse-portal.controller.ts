import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserService } from '../user/user.service';
import { SlaughterhouseService } from './slaughterhouse.service';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, Roles } from '../../common/decorators/roles.decorator';
import { CompleteSlaughterhouseProfileDto } from '../user/dto/complete-slaughterhouse-profile.dto';

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
