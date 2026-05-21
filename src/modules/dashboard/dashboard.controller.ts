import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth(SWAGGER_BEARER)
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('me')
  getMyDashboard(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    if (role === Role.Doctor) {
      return this.dashboardService.getDoctorDashboard(userId);
    }
    if (role === Role.Slaughterhouse) {
      return this.dashboardService.getSlaughterhouseDashboard(userId);
    }
    if (role === Role.Admin) {
      return this.dashboardService.getAdminDashboard();
    }
    return this.dashboardService.getFarmerDashboard(userId);
  }

  @Get('farmer')
  @UseGuards(RolesGuard)
  @Roles(Role.Farmer)
  getFarmerDashboard(@CurrentUser('id') farmerId: string) {
    return this.dashboardService.getFarmerDashboard(farmerId);
  }

  @Get('doctor')
  @UseGuards(RolesGuard)
  @Roles(Role.Doctor)
  getDoctorDashboard(@CurrentUser('id') doctorId: string) {
    return this.dashboardService.getDoctorDashboard(doctorId);
  }

  @Get('slaughterhouse')
  @UseGuards(RolesGuard)
  @Roles(Role.Slaughterhouse)
  getSlaughterhouseDashboard(@CurrentUser('id') operatorId: string) {
    return this.dashboardService.getSlaughterhouseDashboard(operatorId);
  }
}
