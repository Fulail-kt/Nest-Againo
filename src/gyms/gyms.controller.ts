import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload';
import { requireGymId } from '../common/require-gym';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { GymDto, UpdateGymDto } from './dto/gym.dto';
import { GymsService } from './gyms.service';

@ApiTags('gym')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('gyms')
export class GymsController {
  constructor(private readonly gyms: GymsService) {}

  @Get('me')
  @ApiOkResponse({ type: GymDto })
  me(@CurrentUser() user: JwtPayload) {
    return this.gyms.get(requireGymId(user));
  }

  @Patch('me')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  update(@CurrentUser() user: JwtPayload, @Body() dto: UpdateGymDto) {
    return this.gyms.update(requireGymId(user), dto);
  }

  @Get('dashboard')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  dashboard(@CurrentUser() user: JwtPayload) {
    return this.gyms.dashboard(requireGymId(user));
  }
}
