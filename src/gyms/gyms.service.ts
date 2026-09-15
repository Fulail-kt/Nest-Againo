import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { dayKey, normalizeOpenDays } from '../common/day';
import { UpdateGymDto } from './dto/gym.dto';

@Injectable()
export class GymsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(gymId: number) {
    const gym = await this.prisma.gym.findUnique({ where: { id: gymId } });
    if (!gym) {
      throw new NotFoundException('Gym not found');
    }
    return gym;
  }

  update(gymId: number, dto: UpdateGymDto) {
    const data: UpdateGymDto = { ...dto };
    if (dto.openDays) {
      const openDays = normalizeOpenDays(dto.openDays);
      if (openDays.length === 0) {
        throw new BadRequestException('Pick at least one open day');
      }
      data.openDays = openDays;
    }
    return this.prisma.gym.update({ where: { id: gymId }, data });
  }

  async dashboard(gymId: number) {
    const key = dayKey();

    const [members, checkInsToday, workoutsToday] = await Promise.all([
      this.prisma.user.count({
        where: { gymId, role: Role.MEMBER },
      }),
      this.prisma.attendance.count({
        where: { gymId, dayKey: key },
      }),
      this.prisma.workoutSession.count({
        where: {
          status: 'COMPLETED',
          dayKey: key,
          member: { gymId },
        },
      }),
    ]);

    return { members, checkInsToday, workoutsToday };
  }
}
