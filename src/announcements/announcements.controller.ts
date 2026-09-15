import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload';
import { requireGymId } from '../common/require-gym';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/announcement.dto';

@ApiTags('announcements')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.announcements.list(requireGymId(user));
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.announcements.create(requireGymId(user), user.sub, dto);
  }
}
