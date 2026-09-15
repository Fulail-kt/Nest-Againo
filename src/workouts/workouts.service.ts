import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProgrammeMode, WorkoutStatus } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  addDays,
  countStreaks,
  dayKey,
  isGymOpen,
  monthGrid,
  nextOpenDate,
  streakCells,
  weekday,
} from '../common/day';
import { LogExtraDto, LogSetDto } from './dto/workout.dto';

const sessionInclude = {
  sets: true,
  extras: { include: { exercise: true }, orderBy: { completedAt: 'asc' as const } },
  day: {
    include: {
      items: { orderBy: { order: 'asc' as const }, include: { exercise: true } },
      programme: true,
    },
  },
};

function resolveMode(assignment: {
  modeOverride?: ProgrammeMode | null;
  programme: { mode: ProgrammeMode };
}) {
  return assignment.modeOverride ?? assignment.programme.mode;
}

function resolveNextId(assignment: {
  nextProgrammeId?: number | null;
  programme: { nextProgrammeId: number | null };
}) {
  return assignment.nextProgrammeId ?? assignment.programme.nextProgrammeId;
}

@Injectable()
export class WorkoutsService {
  constructor(private readonly prisma: PrismaService) {}

  async today(memberId: number, gymId: number) {
    const gym = await this.prisma.gym.findUnique({ where: { id: gymId } });
    if (!gym) throw new NotFoundException('Gym not found');

    const key = dayKey();
    const gymOpen = isGymOpen(gym.openDays);
    const nextOpen = nextOpenDate(gym.openDays, gymOpen ? addDays(new Date(), 1) : new Date());

    const assignment = await this.prisma.memberProgramme.findFirst({
      where: { memberId, status: 'ACTIVE' },
      orderBy: { assignedAt: 'desc' },
      include: {
        programme: {
          include: {
            days: {
              orderBy: { order: 'asc' },
              include: {
                items: {
                  orderBy: { order: 'asc' },
                  include: { exercise: true },
                },
              },
            },
            nextProgramme: { select: { id: true, name: true } },
          },
        },
      },
    });

    const attendance = await this.prisma.attendance.findUnique({
      where: { memberId_dayKey: { memberId, dayKey: key } },
    });

    const session = await this.prisma.workoutSession.findUnique({
      where: { memberId_dayKey: { memberId, dayKey: key } },
      include: sessionInclude,
    });

    const days = assignment?.programme.days ?? [];
    const last = await this.lastCompletedBefore(
      memberId,
      key,
      assignment?.programmeId,
    );
    const mode = assignment ? resolveMode(assignment) : ProgrammeMode.REPEAT;
    const cycleDay = this.nextProgrammeDay(days, last, mode);
    const programmeDone = !!assignment && mode === ProgrammeMode.FIXED && !cycleDay && !session;

    return {
      dayKey: key,
      gymOpen,
      weekday: weekday(),
      openDays: gym.openDays,
      nextOpenDate: nextOpen ? dayKey(nextOpen) : null,
      checkedIn: !!attendance,
      doneToday: session?.status === WorkoutStatus.COMPLETED,
      programmeDone,
      programme: assignment
        ? { ...assignment.programme, mode: resolveMode(assignment) }
        : null,
      day: session?.day ?? cycleDay,
      session,
    };
  }

  async start(memberId: number, gymId: number, dayId: number) {
    const gym = await this.prisma.gym.findUnique({ where: { id: gymId } });
    if (!gym) throw new NotFoundException('Gym not found');
    if (!isGymOpen(gym.openDays)) {
      throw new BadRequestException('Gym closed today');
    }

    const key = dayKey();
    const existing = await this.prisma.workoutSession.findUnique({
      where: { memberId_dayKey: { memberId, dayKey: key } },
      include: sessionInclude,
    });
    if (existing) {
      if (existing.status === WorkoutStatus.COMPLETED) {
        throw new ConflictException(
          'Today’s workout already submitted. Add extras on this session if you want more.',
        );
      }
      return existing;
    }

    const day = await this.prisma.programmeDay.findFirst({
      where: { id: dayId, programme: { gymId } },
    });
    if (!day) throw new NotFoundException('Workout day not found');

    const todayPayload = await this.today(memberId, gymId);
    if (todayPayload.day && todayPayload.day.id !== dayId) {
      throw new BadRequestException('Start the assigned cycle day for today');
    }

    try {
      return await this.prisma.workoutSession.create({
        data: { memberId, dayId, dayKey: key },
        include: sessionInclude,
      });
    } catch (e) {
      this.rethrowUnique(e, 'Today’s workout already started');
    }
  }

  async logSet(memberId: number, sessionId: number, dto: LogSetDto) {
    const session = await this.ownSession(memberId, sessionId);
    this.assertTodaySession(session.dayKey);
    if (session.status !== WorkoutStatus.IN_PROGRESS) {
      throw new ForbiddenException('Programme sets locked after complete. Use extras.');
    }

    const item = session.day.items.find((i) => i.id === dto.programmeExerciseId);
    if (!item) throw new NotFoundException('Exercise is not in this workout');

    return this.prisma.workoutSet.upsert({
      where: {
        sessionId_programmeExerciseId_setNumber: {
          sessionId,
          programmeExerciseId: dto.programmeExerciseId,
          setNumber: dto.setNumber,
        },
      },
      create: {
        sessionId,
        programmeExerciseId: dto.programmeExerciseId,
        setNumber: dto.setNumber,
        weightKg: dto.weightKg,
        reps: dto.reps,
      },
      update: {
        weightKg: dto.weightKg,
        reps: dto.reps,
        completedAt: new Date(),
      },
    });
  }

  async clearSets(memberId: number, sessionId: number, programmeExerciseId: number) {
    const session = await this.ownSession(memberId, sessionId);
    this.assertTodaySession(session.dayKey);
    if (session.status !== WorkoutStatus.IN_PROGRESS) {
      throw new ForbiddenException('Today’s workout is already submitted.');
    }
    const item = session.day.items.find((i) => i.id === programmeExerciseId);
    if (!item) throw new NotFoundException('Exercise is not in this workout');
    await this.prisma.workoutSet.deleteMany({
      where: { sessionId, programmeExerciseId },
    });
    return { ok: true };
  }

  async logExtra(memberId: number, gymId: number, sessionId: number, dto: LogExtraDto) {
    const session = await this.ownSession(memberId, sessionId);
    this.assertTodaySession(session.dayKey);

    const exercise = await this.prisma.exercise.findFirst({
      where: { id: dto.exerciseId, gymId },
    });
    if (!exercise) throw new NotFoundException('Exercise not in gym library');

    return this.prisma.workoutExtraSet.upsert({
      where: {
        sessionId_exerciseId_setNumber: {
          sessionId,
          exerciseId: dto.exerciseId,
          setNumber: dto.setNumber,
        },
      },
      create: {
        sessionId,
        exerciseId: dto.exerciseId,
        setNumber: dto.setNumber,
        weightKg: dto.weightKg,
        reps: dto.reps,
      },
      update: {
        weightKg: dto.weightKg,
        reps: dto.reps,
        completedAt: new Date(),
      },
    });
  }

  async removeExtra(memberId: number, sessionId: number, exerciseId: number) {
    const session = await this.ownSession(memberId, sessionId);
    this.assertTodaySession(session.dayKey);
    await this.prisma.workoutExtraSet.deleteMany({
      where: { sessionId, exerciseId },
    });
    return { ok: true };
  }

  async complete(memberId: number, sessionId: number) {
    const session = await this.ownSession(memberId, sessionId);
    this.assertTodaySession(session.dayKey);
    if (session.status === WorkoutStatus.COMPLETED) {
      throw new ConflictException('Workout already submitted today');
    }
    const updated = await this.prisma.workoutSession.update({
      where: { id: sessionId },
      data: { status: WorkoutStatus.COMPLETED, completedAt: new Date() },
      include: sessionInclude,
    });
    await this.maybeFinishFixed(memberId, updated.day.programmeId, updated.dayId);
    return updated;
  }

  history(memberId: number) {
    return this.prisma.workoutSession.findMany({
      where: { memberId, status: WorkoutStatus.COMPLETED },
      orderBy: { completedAt: 'desc' },
      take: 40,
      include: {
        day: { include: { programme: true } },
        sets: true,
        extras: { include: { exercise: true } },
      },
    });
  }

  async calendar(memberId: number, gymId: number, year: number, month: number) {
    const gym = await this.prisma.gym.findUnique({ where: { id: gymId } });
    if (!gym) throw new NotFoundException('Gym not found');

    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0);
    const end = dayKey(endDate);

    const [sessions, checkIns] = await Promise.all([
      this.prisma.workoutSession.findMany({
        where: { memberId, dayKey: { gte: start, lte: end } },
        include: {
          day: true,
          extras: true,
        },
      }),
      this.prisma.attendance.findMany({
        where: { memberId, dayKey: { gte: start, lte: end } },
      }),
    ]);

    const sessionByDay = new Map(sessions.map((s) => [s.dayKey, s]));
    const checkByDay = new Set(checkIns.map((a) => a.dayKey));

    const days = monthGrid(year, month).map((cell) => {
      if (!cell.inMonth) {
        return { ...cell, gymOpen: false, checkedIn: false, workout: null };
      }
      const session = sessionByDay.get(cell.date);
      return {
        ...cell,
        gymOpen: gym.openDays.includes(cell.weekday),
        checkedIn: checkByDay.has(cell.date),
        workout: session
          ? {
              name: session.day.name,
              status: session.status,
              extraCount: session.extras.length,
            }
          : null,
      };
    });

    const assignment = await this.prisma.memberProgramme.findFirst({
      where: { memberId, status: 'ACTIVE' },
      orderBy: { assignedAt: 'desc' },
      include: { programme: { include: { days: { orderBy: { order: 'asc' } } } } },
    });
    const cycleDays = assignment?.programme.days ?? [];
    const today = dayKey();
    const last = await this.lastCompletedBefore(memberId, today, assignment?.programmeId);
    const mode = assignment ? resolveMode(assignment) : ProgrammeMode.REPEAT;
    const startIndex = this.nextProgrammeIndex(cycleDays, last, mode);

    const todaySession = sessionByDay.get(today);
    const startFrom = todaySession?.status === WorkoutStatus.COMPLETED ? addDays(new Date(), 1) : new Date();

    const upcoming: { date: string; name: string }[] = [];
    if (cycleDays.length && startIndex != null) {
      let cursor = startIndex;
      for (let i = 0; i < 21 && upcoming.length < 7; i++) {
        const d = addDays(startFrom, i);
        if (!isGymOpen(gym.openDays, d)) continue;
        const key = dayKey(d);
        if (key === today && todaySession) continue;
        upcoming.push({ date: key, name: cycleDays[cursor].name });
        if (mode === ProgrammeMode.FIXED) {
          if (cursor >= cycleDays.length - 1) break;
          cursor += 1;
        } else {
          cursor = (cursor + 1) % cycleDays.length;
        }
      }
    }

    return {
      year,
      month,
      openDays: gym.openDays,
      days,
      upcoming,
    };
  }

  async streak(memberId: number, gymId: number) {
    const gym = await this.prisma.gym.findUnique({ where: { id: gymId } });
    if (!gym) throw new NotFoundException('Gym not found');

    const today = new Date();
    const from = dayKey(addDays(today, -83));
    const sessions = await this.prisma.workoutSession.findMany({
      where: {
        memberId,
        status: WorkoutStatus.COMPLETED,
        dayKey: { gte: from },
      },
      select: { dayKey: true },
    });
    const cells = streakCells(
      gym.openDays,
      new Set(sessions.map((s) => s.dayKey)),
      today,
    );
    return { ...countStreaks(cells), cells };
  }

  async progress(memberId: number, exerciseId?: number) {
    return this.prisma.workoutSet.findMany({
      where: {
        session: { memberId, status: WorkoutStatus.COMPLETED },
        ...(exerciseId ? { programmeExercise: { exerciseId } } : {}),
      },
      orderBy: { completedAt: 'desc' },
      take: 80,
      include: {
        programmeExercise: { include: { exercise: true } },
      },
    });
  }

  private async lastCompletedBefore(
    memberId: number,
    beforeKey: string,
    programmeId?: number,
  ) {
    return this.prisma.workoutSession.findFirst({
      where: {
        memberId,
        status: WorkoutStatus.COMPLETED,
        dayKey: { lt: beforeKey },
        ...(programmeId ? { day: { programmeId } } : {}),
      },
      orderBy: { dayKey: 'desc' },
    });
  }

  private nextProgrammeIndex(
    days: { id: number }[],
    last: { dayId: number } | null,
    mode: ProgrammeMode,
  ) {
    if (!days.length) return null;
    if (!last) return 0;
    const lastIndex = days.findIndex((d) => d.id === last.dayId);
    if (lastIndex < 0) return 0;
    if (mode === ProgrammeMode.FIXED) {
      return lastIndex >= days.length - 1 ? null : lastIndex + 1;
    }
    return (lastIndex + 1) % days.length;
  }

  private nextProgrammeDay<T extends { id: number }>(
    days: T[],
    last: { dayId: number } | null,
    mode: ProgrammeMode,
  ) {
    const index = this.nextProgrammeIndex(days, last, mode);
    return index == null ? null : days[index];
  }

  private async maybeFinishFixed(memberId: number, programmeId: number, dayId: number) {
    const assignment = await this.prisma.memberProgramme.findFirst({
      where: { memberId, programmeId, status: 'ACTIVE' },
      include: {
        programme: { include: { days: { orderBy: { order: 'asc' } } } },
      },
    });
    if (!assignment) return;
    if (resolveMode(assignment) !== ProgrammeMode.FIXED) return;
    const lastDay = assignment.programme.days[assignment.programme.days.length - 1];
    if (!lastDay || lastDay.id !== dayId) return;

    await this.prisma.memberProgramme.update({
      where: { id: assignment.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    const nextId = resolveNextId(assignment);
    if (!nextId) return;

    await this.prisma.memberProgramme.updateMany({
      where: { memberId, status: 'ACTIVE' },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    await this.prisma.memberProgramme.upsert({
      where: { memberId_programmeId: { memberId, programmeId: nextId } },
      create: { memberId, programmeId: nextId, status: 'ACTIVE' },
      update: { status: 'ACTIVE', assignedAt: new Date(), completedAt: null, modeOverride: null, nextProgrammeId: null },
    });
  }

  private assertTodaySession(sessionDayKey: string) {
    if (sessionDayKey !== dayKey()) {
      throw new ForbiddenException('Can only edit today’s workout');
    }
  }

  private async ownSession(memberId: number, sessionId: number) {
    const session = await this.prisma.workoutSession.findFirst({
      where: { id: sessionId, memberId },
      include: {
        day: { include: { items: true } },
      },
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  private rethrowUnique(e: unknown, message: string): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictException(message);
    }
    throw e;
  }
}
