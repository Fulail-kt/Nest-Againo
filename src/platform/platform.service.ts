import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const OWNER_ROLES: Role[] = [Role.OWNER, Role.GYM_ADMIN, Role.SHOP_OWNER];

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  listOwners() {
    return this.prisma.user
      .findMany({
        where: { role: { in: OWNER_ROLES } },
        include: { gym: true, shop: true },
        orderBy: { createdAt: 'desc' },
        take: 300,
      })
      .then((rows) => rows.map((u) => this.toList(u)));
  }

  async getOwner(id: number) {
    const u = await this.prisma.user.findFirst({
      where: { id, role: { in: OWNER_ROLES } },
      include: { gym: true, shop: true },
    });
    if (!u) throw new NotFoundException('Owner not found');
    const memberOrStaffCount = u.gymId
      ? await this.prisma.user.count({ where: { gymId: u.gymId, role: Role.MEMBER } })
      : u.shopId
        ? await this.prisma.shopMember.count({ where: { shopId: u.shopId } })
        : 0;
    return { ...this.toList(u), gymId: u.gymId, shopId: u.shopId, memberOrStaffCount };
  }

  private toList(u: {
    id: number;
    email: string;
    name: string;
    role: Role;
    status: string;
    emailVerifiedAt: Date | null;
    createdAt: Date;
    gym: { name: string } | null;
    shop: { name: string } | null;
  }) {
    const companyType = u.gym ? 'GYM' : u.shop ? 'BARBER' : null;
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      status: u.status,
      emailVerified: !!u.emailVerifiedAt,
      companyName: u.gym?.name ?? u.shop?.name ?? null,
      companyType,
      createdAt: u.createdAt,
    };
  }
}
