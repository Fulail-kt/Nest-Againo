import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  create(gymId: number, authorId: number, dto: CreateAnnouncementDto) {
    return this.prisma.announcement.create({
      data: { gymId, authorId, title: dto.title, body: dto.body },
    });
  }

  list(gymId: number) {
    return this.prisma.announcement.findMany({
      where: { gymId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        body: true,
        createdAt: true,
        author: { select: { name: true } },
      },
    });
  }
}
