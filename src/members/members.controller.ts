import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload';
import { requireGymId } from '../common/require-gym';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import {
  AssignProgrammeDto,
  CreateMemberDto,
  MemberQueryDto,
  UpdateMemberDto,
} from './dto/member.dto';
import { MembersService } from './members.service';

@ApiTags('members')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.GYM_ADMIN)
@Controller('members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: MemberQueryDto) {
    return this.members.list(requireGymId(user), query.q);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateMemberDto) {
    return this.members.create(requireGymId(user), dto);
  }

  @Get(':id')
  get(@CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    return this.members.get(requireGymId(user), id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.members.update(requireGymId(user), id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    return this.members.remove(requireGymId(user), id);
  }

  @Post(':id/programmes')
  assign(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignProgrammeDto,
  ) {
    return this.members.assignProgramme(requireGymId(user), id, dto);
  }

  @Get(':id/attendance')
  attendance(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.members.attendance(requireGymId(user), id);
  }

  @Get(':id/progress')
  progress(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.members.progress(requireGymId(user), id);
  }
}
