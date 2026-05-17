import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserService } from '../user/user.service';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, Roles } from '../../common/decorators/roles.decorator';
import { CompleteDoctorProfileDto } from '../user/dto/complete-doctor-profile.dto';

@ApiTags('Doctor')
@ApiBearerAuth(SWAGGER_BEARER)
@Controller('doctor')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Doctor)
export class DoctorController {
  constructor(private readonly userService: UserService) {}

  @Patch('profile')
  completeProfile(
    @CurrentUser('id') doctorId: string,
    @Body() dto: CompleteDoctorProfileDto,
  ) {
    return this.userService.completeDoctorProfile(doctorId, dto);
  }
}
