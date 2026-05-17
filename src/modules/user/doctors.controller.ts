import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { Public } from '../../common/decorators/public.decorator';
import { ListDoctorsQueryDto } from './dto/list-doctors-query.dto';

@ApiTags('Doctors')
@Controller('doctors')
export class DoctorsController {
  constructor(private readonly userService: UserService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List approved veterinarians (public)' })
  list(@Query() query: ListDoctorsQueryDto) {
    return this.userService.listPublicDoctors(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get veterinarian profile (public)' })
  getOne(@Param('id') id: string) {
    return this.userService.getPublicDoctorById(id);
  }
}
