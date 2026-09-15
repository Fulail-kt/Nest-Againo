import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { dayKey, isGymOpen } from '../common/day';
import { distanceMeters } from '../common/geo';
import { PrismaService } from '../prisma/prisma.service';
import { CheckInDto } from './dto/check-in.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async checkIn(memberId: number, gymId: number, dto: CheckInDto) {
    const gym = await this.prisma.gym.findUnique({ where: { id: gymId } });
    if (!gym) {
      throw new NotFoundException('Gym not found');
    }
    if (!isGymOpen(gym.openDays)) {
      throw new BadRequestException('Gym closed today');
    }
    if (gym.lat == null || gym.lng == null) {
      throw new BadRequestException('Gym location is not configured');
    }

    const meters = distanceMeters(
      { lat: dto.lat, lng: dto.lng },
      { lat: gym.lat, lng: gym.lng },
    );
    if (meters > gym.attendanceRadiusMeters) {
      throw new BadRequestException(
        `Too far from gym (${Math.round(meters)}m, max ${gym.attendanceRadiusMeters}m)`,
      );
    }

    const key = dayKey();
    try {
      return await this.prisma.attendance.create({
        data: {
          memberId,
          gymId,
          lat: dto.lat,
          lng: dto.lng,
          dayKey: key,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Already checked in today');
      }
      throw e;
    }
  }

  mine(memberId: number) {
    return this.prisma.attendance.findMany({
      where: { memberId },
      orderBy: { checkedInAt: 'desc' },
      take: 60,
    });
  }

  gym(gymId: number) {
    return this.prisma.attendance.findMany({
      where: { gymId },
      orderBy: { checkedInAt: 'desc' },
      take: 100,
      include: {
        member: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
