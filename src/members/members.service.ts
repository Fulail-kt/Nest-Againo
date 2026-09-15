import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Role, WorkoutStatus } from '../../generated/prisma/client';
import { toPublicUser } from '../common/to-public-user';
import { PrismaService } from '../prisma/prisma.service';
import { AssignProgrammeDto, CreateMemberDto, UpdateMemberDto } from './dto/member.dto';

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(gymId: number, q?: string) {
    const members = await this.prisma.user.findMany({
      where: {
        gymId,
        role: Role.MEMBER,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return members.map(toPublicUser);
  }

  async create(gymId: number, dto: CreateMemberDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: await bcrypt.hash(dto.password, 10),
        role: Role.MEMBER,
        gymId,
      },
    });
    return toPublicUser(user);
  }

  async get(gymId: number, id: number) {
    const user = await this.prisma.user.findFirst({
      where: { id, gymId, role: Role.MEMBER },
      include: {
        assignments: {
          include: { programme: true },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('Member not found');
    }

    const [completedWorkouts, attendanceCount, lastAttendance, recentWorkouts, recentAttendance] =
      await Promise.all([
        this.prisma.workoutSession.count({
          where: { memberId: id, status: WorkoutStatus.COMPLETED },
        }),
        this.prisma.attendance.count({ where: { memberId: id, gymId } }),
        this.prisma.attendance.findFirst({
          where: { memberId: id, gymId },
          orderBy: { checkedInAt: 'desc' },
        }),
        this.prisma.workoutSession.findMany({
          where: { memberId: id },
          orderBy: { startedAt: 'desc' },
          take: 8,
          include: {
            day: { include: { programme: { select: { name: true } } } },
            _count: { select: { sets: true, extras: true } },
          },
        }),
        this.prisma.attendance.findMany({
          where: { memberId: id, gymId },
          orderBy: { checkedInAt: 'desc' },
          take: 8,
        }),
      ]);

    const active = user.assignments.find((a) => a.status === 'ACTIVE') ?? null;

    return {
      ...toPublicUser(user),
      programmes: user.assignments.map((a) => a.programme),
      activeProgramme: active
        ? {
            id: active.programme.id,
            name: active.programme.name,
            assignedAt: active.assignedAt,
          }
        : null,
      stats: {
        completedWorkouts,
        attendanceCount,
        lastCheckIn: lastAttendance?.checkedInAt ?? null,
        lastWorkout: recentWorkouts[0]?.dayKey ?? null,
      },
      recentWorkouts: recentWorkouts.map((s) => ({
        id: s.id,
        dayKey: s.dayKey,
        name: s.day?.name ?? 'Workout',
        programme: s.day?.programme?.name ?? null,
        status: s.status,
        sets: s._count.sets,
        extras: s._count.extras,
      })),
      recentAttendance: recentAttendance.map((a) => ({
        id: a.id,
        dayKey: a.dayKey,
        checkedInAt: a.checkedInAt,
      })),
    };
  }

  async update(gymId: number, id: number, dto: UpdateMemberDto) {
    await this.get(gymId, id);
    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
    });
    return toPublicUser(user);
  }

  async remove(gymId: number, id: number) {
    await this.get(gymId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.announcement.deleteMany({ where: { authorId: id } });
      await tx.user.delete({ where: { id } });
    });
    return { ok: true };
  }

  async assignProgramme(gymId: number, memberId: number, dto: AssignProgrammeDto) {
    await this.get(gymId, memberId);
    const programme = await this.prisma.programme.findFirst({
      where: { id: dto.programmeId, gymId },
    });
    if (!programme) {
      throw new NotFoundException('Programme not found');
    }
    if (dto.nextProgrammeId) {
      const next = await this.prisma.programme.findFirst({
        where: { id: dto.nextProgrammeId, gymId },
      });
      if (!next) throw new NotFoundException('Next programme not found');
    }
    const override = {
      modeOverride: dto.mode ?? null,
      nextProgrammeId: dto.nextProgrammeId ?? null,
    };
    return this.prisma.$transaction(async (tx) => {
      await tx.memberProgramme.updateMany({
        where: { memberId, status: 'ACTIVE' },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      return tx.memberProgramme.upsert({
        where: { memberId_programmeId: { memberId, programmeId: dto.programmeId } },
        create: { memberId, programmeId: dto.programmeId, status: 'ACTIVE', ...override },
        update: {
          status: 'ACTIVE',
          assignedAt: new Date(),
          completedAt: null,
          ...override,
        },
      });
    });
  }

  attendance(gymId: number, memberId: number) {
    return this.prisma.attendance.findMany({
      where: { memberId, gymId },
      orderBy: { checkedInAt: 'desc' },
      take: 50,
    });
  }

  progress(gymId: number, memberId: number) {
    return this.prisma.workoutSession.findMany({
      where: { memberId, member: { gymId } },
      orderBy: { startedAt: 'desc' },
      take: 30,
      include: {
        day: { include: { programme: true } },
        sets: true,
      },
    });
  }
}
