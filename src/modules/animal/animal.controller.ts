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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AnimalService } from './animal.service';
import { SWAGGER_BEARER } from '../../common/swagger/swagger.setup';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { UpdateAnimalDto } from './dto/update-animal.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Animals')
@ApiBearerAuth(SWAGGER_BEARER)
@Controller('animals')
@UseGuards(JwtAuthGuard)
export class AnimalController {
  constructor(private readonly animalService: AnimalService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.Farmer)
  create(@Body() dto: CreateAnimalDto, @CurrentUser('id') farmerId: string) {
    return this.animalService.create(dto, farmerId);
  }

  @Get()
  findAll(@Query() pagination: PaginationDto, @CurrentUser() user: { id: string; role: Role }) {
    if (user.role === Role.Doctor) {
      return this.animalService.findForDoctor(user.id, pagination);
    }
    if (user.role === Role.Admin) {
      return this.animalService.findAllAdmin(pagination);
    }
    return this.animalService.findForFarmer(user.id, pagination);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.animalService.findOne(id, userId, role);
  }

  @Patch(':id')
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
  remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.animalService.remove(id, userId, role);
  }
}
