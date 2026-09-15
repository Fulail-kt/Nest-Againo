import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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
import { LogExtraDto, LogSetDto, ClearSetsDto, StartWorkoutDto } from './dto/workout.dto';
import { WorkoutsService } from './workouts.service';

@ApiTags('workouts')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.MEMBER)
@Controller('workouts')
export class WorkoutsController {
  constructor(private readonly workouts: WorkoutsService) {}

  @Get('today')
  today(@CurrentUser() user: JwtPayload) {
    return this.workouts.today(user.sub, requireGymId(user));
  }

  @Get('calendar')
  calendar(
    @CurrentUser() user: JwtPayload,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const now = new Date();
    return this.workouts.calendar(
      user.sub,
      requireGymId(user),
      year ? Number(year) : now.getFullYear(),
      month ? Number(month) : now.getMonth() + 1,
    );
  }

  @Get('streak')
  streak(@CurrentUser() user: JwtPayload) {
    return this.workouts.streak(user.sub, requireGymId(user));
  }

  @Post('start')
  start(@CurrentUser() user: JwtPayload, @Body() dto: StartWorkoutDto) {
    return this.workouts.start(user.sub, requireGymId(user), dto.dayId);
  }

  @Post(':sessionId/clear-sets')
  clearSets(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() dto: ClearSetsDto,
  ) {
    return this.workouts.clearSets(user.sub, sessionId, dto.programmeExerciseId);
  }

  @Post(':sessionId/sets')
  logSet(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() dto: LogSetDto,
  ) {
    return this.workouts.logSet(user.sub, sessionId, dto);
  }

  @Post(':sessionId/extras')
  logExtra(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() dto: LogExtraDto,
  ) {
    return this.workouts.logExtra(user.sub, requireGymId(user), sessionId, dto);
  }

  @Delete(':sessionId/extras/:exerciseId')
  removeExtra(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Param('exerciseId', ParseIntPipe) exerciseId: number,
  ) {
    return this.workouts.removeExtra(user.sub, sessionId, exerciseId);
  }

  @Post(':sessionId/complete')
  complete(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId', ParseIntPipe) sessionId: number,
  ) {
    return this.workouts.complete(user.sub, sessionId);
  }

  @Get('history')
  history(@CurrentUser() user: JwtPayload) {
    return this.workouts.history(user.sub);
  }

  @Get('progress')
  progress(
    @CurrentUser() user: JwtPayload,
    @Query('exerciseId') exerciseId?: string,
  ) {
    return this.workouts.progress(
      user.sub,
      exerciseId ? Number(exerciseId) : undefined,
    );
  }
}
