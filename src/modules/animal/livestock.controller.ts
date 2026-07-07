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
import { AnimalService } from './animal.service';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
import { LIVESTOCK_TAG } from '../../common/swagger/api-descriptions';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { UpdateAnimalDto } from './dto/update-animal.dto';
import { TransferLivestockDto } from './dto/transfer-livestock.dto';
import { ListLivestockQueryDto } from './dto/list-livestock-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Livestock')
@ApiBearerAuth(SWAGGER_BEARER)
@Controller('livestock')
@UseGuards(JwtAuthGuard)
export class LivestockController {
  constructor(private readonly animalService: AnimalService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.Farmer)
  @ApiOperation({
    summary: 'Register livestock',
    description: LIVESTOCK_TAG,
  })
  create(@Body() dto: CreateAnimalDto, @CurrentUser('id') farmerId: string) {
    return this.animalService.create(dto, farmerId);
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles(Role.Farmer)
  @ApiOperation({ summary: 'Farmer livestock summary (total / healthy / sick)' })
  farmerStats(@CurrentUser('id') farmerId: string) {
    return this.animalService.getFarmerLivestockStats(farmerId);
  }

  @Get()
  @ApiOperation({
    summary: 'List livestock (herd)',
    description: 'Farmers: filter by ?species= &healthStatus= &obtainedBy= &search=',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  findAll(@Query() query: ListLivestockQueryDto, @CurrentUser() user: { id: string; role: Role }) {
    const { page, limit, ...filters } = query;
    const pagination = { page, limit };
    if (user.role === Role.Doctor) {
      return this.animalService.findForDoctor(user.id, pagination);
    }
    if (user.role === Role.Admin) {
      return this.animalService.findAllAdmin(pagination);
    }
    return this.animalService.findForFarmer(user.id, pagination, filters as ListLivestockQueryDto);
  }

  @Get(':id/qr-code')
  @UseGuards(RolesGuard)
  @Roles(Role.Farmer)
  @ApiOperation({ summary: 'Generate QR code data for livestock (Figma)' })
  getQrCode(@Param('id') id: string, @CurrentUser('id') farmerId: string) {
    return this.animalService.getQrCode(id, farmerId);
  }

  @Post(':id/transfer')
  @UseGuards(RolesGuard)
  @Roles(Role.Farmer)
  @ApiOperation({
    summary: 'Transfer livestock to another farmer',
    description: 'Figma Transfer Animal — receiver phone/email must match a registered farmer.',
  })
  transfer(
    @Param('id') id: string,
    @Body() dto: TransferLivestockDto,
    @CurrentUser('id') farmerId: string,
  ) {
    return this.animalService.transferLivestock(id, farmerId, dto);
  }

  @Patch(':id/slaughter')
  @UseGuards(RolesGuard)
  @Roles(Role.Farmer)
  @ApiOperation({ summary: 'Mark livestock as slaughtered (Figma)' })
  markSlaughtered(@Param('id') id: string, @CurrentUser('id') farmerId: string) {
    return this.animalService.markSlaughtered(id, farmerId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get livestock by ID',
    description: 'Farmers receive full detail (visits, vet info, charts).',
  })
  @ApiParam({ name: 'id', description: 'MongoDB animal _id' })
  findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.animalService.findOne(id, userId, role);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.Farmer, Role.Doctor, Role.Admin)
  @ApiOperation({ summary: 'Update livestock' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAnimalDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.animalService.update(id, dto, userId, role);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.Farmer, Role.Admin)
  @ApiOperation({ summary: 'Remove livestock record' })
  remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.animalService.remove(id, userId, role);
  }
}
