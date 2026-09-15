import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
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
  AddDayDto,
  AddDayExerciseDto,
  CreateProgrammeDto,
  PatchExerciseDto,
  PatchProgrammeDto,
  ReorderDto,
} from './dto/programme.dto';
import { ProgrammesService } from './programmes.service';

@ApiTags('programmes')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('programmes')
export class ProgrammesController {
  constructor(private readonly programmes: ProgrammesService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.programmes.list(requireGymId(user));
  }

  @Get(':id')
  get(@CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    return this.programmes.get(requireGymId(user), id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateProgrammeDto) {
    return this.programmes.create(requireGymId(user), dto);
  }

  @Patch('exercises/:itemId')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  patchExercise(
    @CurrentUser() user: JwtPayload,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: PatchExerciseDto,
  ) {
    return this.programmes.patchExercise(requireGymId(user), itemId, dto);
  }

  @Delete('exercises/:itemId')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  removeExercise(
    @CurrentUser() user: JwtPayload,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.programmes.removeExercise(requireGymId(user), itemId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  patch(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PatchProgrammeDto,
  ) {
    return this.programmes.patch(requireGymId(user), id, dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  replace(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateProgrammeDto,
  ) {
    return this.programmes.replace(requireGymId(user), id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    return this.programmes.remove(requireGymId(user), id);
  }

  @Post(':id/days')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  addDay(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddDayDto,
  ) {
    return this.programmes.addDay(requireGymId(user), id, dto);
  }

  @Post(':id/reorder-days')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  reorderDays(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReorderDto,
  ) {
    return this.programmes.reorderDays(requireGymId(user), id, dto);
  }

  @Post('days/:dayId/exercises')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  addExercise(
    @CurrentUser() user: JwtPayload,
    @Param('dayId', ParseIntPipe) dayId: number,
    @Body() dto: AddDayExerciseDto,
  ) {
    return this.programmes.addDayExercise(requireGymId(user), dayId, dto);
  }

  @Post('days/:dayId/reorder-exercises')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  reorderExercises(
    @CurrentUser() user: JwtPayload,
    @Param('dayId', ParseIntPipe) dayId: number,
    @Body() dto: ReorderDto,
  ) {
    return this.programmes.reorderExercises(requireGymId(user), dayId, dto);
  }
}
