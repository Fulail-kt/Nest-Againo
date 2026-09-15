import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload';
import { requireGymId } from '../common/require-gym';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { AttendanceService } from './attendance.service';
import { CheckInDto } from './dto/check-in.dto';

@ApiTags('attendance')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post('check-in')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER)
  checkIn(@CurrentUser() user: JwtPayload, @Body() dto: CheckInDto) {
    return this.attendance.checkIn(user.sub, requireGymId(user), dto);
  }

  @Get('me')
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER)
  mine(@CurrentUser() user: JwtPayload) {
    return this.attendance.mine(user.sub);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  gym(@CurrentUser() user: JwtPayload) {
    return this.attendance.gym(requireGymId(user));
  }
}
