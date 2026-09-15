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
  CatalogQueryDto,
  ImportCatalogDto,
  UpsertExerciseDto,
} from './dto/exercise.dto';
import { ExercisesService } from './exercises.service';

@ApiTags('exercises')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercises: ExercisesService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.exercises.list(requireGymId(user));
  }

  @Get('catalog')
  catalog(@CurrentUser() user: JwtPayload, @Query() query: CatalogQueryDto) {
    return this.exercises.catalog(requireGymId(user), query);
  }

  @Get('catalog/bodyparts')
  catalogBodyParts() {
    return this.exercises.catalogBodyParts();
  }

  @Post('from-catalog')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  fromCatalog(@CurrentUser() user: JwtPayload, @Body() dto: ImportCatalogDto) {
    return this.exercises.importFromCatalog(requireGymId(user), dto);
  }

  @Get(':id')
  get(@CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    return this.exercises.get(requireGymId(user), id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  create(@CurrentUser() user: JwtPayload, @Body() dto: UpsertExerciseDto) {
    return this.exercises.create(requireGymId(user), dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertExerciseDto,
  ) {
    return this.exercises.update(requireGymId(user), id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GYM_ADMIN)
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    return this.exercises.remove(requireGymId(user), id);
  }
}
