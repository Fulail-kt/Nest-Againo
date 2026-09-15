import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProgrammeMode } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddDayDto,
  AddDayExerciseDto,
  CreateProgrammeDto,
  PatchExerciseDto,
  PatchProgrammeDto,
  ReorderDto,
} from './dto/programme.dto';

const dayInclude = {
  items: { include: { exercise: true }, orderBy: { order: 'asc' as const } },
};

const programmeInclude = {
  days: { orderBy: { order: 'asc' as const }, include: dayInclude },
  nextProgramme: { select: { id: true, name: true, mode: true } },
};

@Injectable()
export class ProgrammesService {
  constructor(private readonly prisma: PrismaService) {}

  list(gymId: number) {
    return this.prisma.programme.findMany({
      where: { gymId },
      orderBy: { createdAt: 'desc' },
      include: {
        days: {
          orderBy: { order: 'asc' },
          include: { _count: { select: { items: true } } },
        },
        nextProgramme: { select: { id: true, name: true } },
      },
    });
  }

  async get(gymId: number, id: number) {
    const programme = await this.prisma.programme.findFirst({
      where: { id, gymId },
      include: programmeInclude,
    });
    if (!programme) throw new NotFoundException('Programme not found');
    return programme;
  }

  async create(gymId: number, dto: CreateProgrammeDto) {
    if (dto.nextProgrammeId) {
      await this.assertNext(gymId, dto.nextProgrammeId);
    }
    await this.assertGymExercises(
      gymId,
      dto.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)),
    );
    return this.prisma.programme.create({
      data: {
        gymId,
        name: dto.name,
        description: dto.description,
        mode: dto.mode ?? ProgrammeMode.REPEAT,
        nextProgrammeId: dto.nextProgrammeId,
        days: {
          create: dto.days.map((day, di) => ({
            name: day.name,
            order: day.order ?? di,
            items: {
              create: day.exercises.map((item, ei) => ({
                exerciseId: item.exerciseId,
                order: item.order ?? ei,
                sets: item.sets,
                reps: item.reps,
                restSeconds: item.restSeconds,
                durationSeconds: item.durationSeconds,
                notes: item.notes,
              })),
            },
          })),
        },
      },
      include: programmeInclude,
    });
  }

  async patch(gymId: number, id: number, dto: PatchProgrammeDto) {
    await this.get(gymId, id);
    if (dto.nextProgrammeId) {
      if (dto.nextProgrammeId === id) {
        throw new BadRequestException('Programme cannot follow itself');
      }
      await this.assertNext(gymId, dto.nextProgrammeId);
    }
    return this.prisma.programme.update({
      where: { id },
      data: dto,
      include: programmeInclude,
    });
  }

  async replace(gymId: number, id: number, dto: CreateProgrammeDto) {
    await this.get(gymId, id);
    if (dto.nextProgrammeId) {
      if (dto.nextProgrammeId === id) {
        throw new BadRequestException('Programme cannot follow itself');
      }
      await this.assertNext(gymId, dto.nextProgrammeId);
    }
    await this.assertGymExercises(
      gymId,
      dto.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)),
    );
    const sessions = await this.prisma.workoutSession.count({
      where: { day: { programmeId: id } },
    });
    if (sessions > 0) {
      throw new ConflictException(
        'This programme already has workout history. Create a new programme instead of replacing it.',
      );
    }
    await this.prisma.programmeDay.deleteMany({ where: { programmeId: id } });
    return this.prisma.programme.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        mode: dto.mode ?? ProgrammeMode.REPEAT,
        nextProgrammeId: dto.nextProgrammeId ?? null,
        days: {
          create: dto.days.map((day, di) => ({
            name: day.name,
            order: day.order ?? di,
            items: {
              create: day.exercises.map((item, ei) => ({
                exerciseId: item.exerciseId,
                order: item.order ?? ei,
                sets: item.sets,
                reps: item.reps,
                restSeconds: item.restSeconds,
                durationSeconds: item.durationSeconds,
                notes: item.notes,
              })),
            },
          })),
        },
      },
      include: programmeInclude,
    });
  }

  async remove(gymId: number, id: number) {
    await this.get(gymId, id);
    const sessions = await this.prisma.workoutSession.count({
      where: { day: { programmeId: id } },
    });
    if (sessions > 0) {
      throw new ConflictException(
        'Cannot delete a programme with workout history.',
      );
    }
    await this.prisma.programme.delete({ where: { id } });
    return { ok: true };
  }

  async addDay(gymId: number, programmeId: number, dto: AddDayDto) {
    const programme = await this.get(gymId, programmeId);
    return this.prisma.programmeDay.create({
      data: {
        programmeId,
        name: dto.name,
        order: programme.days.length,
      },
      include: dayInclude,
    });
  }

  async reorderDays(gymId: number, programmeId: number, dto: ReorderDto) {
    await this.get(gymId, programmeId);
    await this.prisma.$transaction(
      dto.ids.map((id, order) =>
        this.prisma.programmeDay.updateMany({
          where: { id, programmeId },
          data: { order },
        }),
      ),
    );
    return this.get(gymId, programmeId);
  }

  async addDayExercise(gymId: number, dayId: number, dto: AddDayExerciseDto) {
    const day = await this.prisma.programmeDay.findFirst({
      where: { id: dayId, programme: { gymId } },
      include: { items: true },
    });
    if (!day) throw new NotFoundException('Workout day not found');
    await this.assertGymExercises(gymId, [dto.exerciseId]);
    return this.prisma.programmeExercise.create({
      data: {
        dayId,
        exerciseId: dto.exerciseId,
        order: dto.order ?? day.items.length,
        sets: dto.sets,
        reps: dto.reps,
        restSeconds: dto.restSeconds,
        durationSeconds: dto.durationSeconds,
        notes: dto.notes,
      },
      include: { exercise: true },
    });
  }

  async patchExercise(gymId: number, itemId: number, dto: PatchExerciseDto) {
    const item = await this.prisma.programmeExercise.findFirst({
      where: { id: itemId, day: { programme: { gymId } } },
    });
    if (!item) throw new NotFoundException('Exercise slot not found');
    return this.prisma.programmeExercise.update({
      where: { id: itemId },
      data: dto,
      include: { exercise: true },
    });
  }

  async removeExercise(gymId: number, itemId: number) {
    const item = await this.prisma.programmeExercise.findFirst({
      where: { id: itemId, day: { programme: { gymId } } },
    });
    if (!item) throw new NotFoundException('Exercise slot not found');
    await this.prisma.programmeExercise.delete({ where: { id: itemId } });
    return { ok: true };
  }

  async reorderExercises(gymId: number, dayId: number, dto: ReorderDto) {
    const day = await this.prisma.programmeDay.findFirst({
      where: { id: dayId, programme: { gymId } },
    });
    if (!day) throw new NotFoundException('Workout day not found');
    await this.prisma.$transaction(
      dto.ids.map((id, order) =>
        this.prisma.programmeExercise.updateMany({
          where: { id, dayId },
          data: { order },
        }),
      ),
    );
    return this.prisma.programmeDay.findFirst({
      where: { id: dayId },
      include: dayInclude,
    });
  }

  private async assertNext(gymId: number, id: number) {
    const next = await this.prisma.programme.findFirst({ where: { id, gymId } });
    if (!next) throw new NotFoundException('Next programme not found');
  }

  private async assertGymExercises(gymId: number, ids: number[]) {
    const unique = [...new Set(ids)];
    if (!unique.length) return;
    const n = await this.prisma.exercise.count({
      where: { gymId, id: { in: unique } },
    });
    if (n !== unique.length) throw new BadRequestException('Exercise not in this gym');
  }
}
