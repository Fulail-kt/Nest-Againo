import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../generated/prisma/client';
import type { JwtPayload } from '../auth/jwt-payload';
import { PrismaService } from '../prisma/prisma.service';
import { SHOP_ADMIN_KEY } from './roles.decorator';

@Injectable()
export class ShopAdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const need = this.reflector.getAllAndOverride<boolean>(SHOP_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!need) return true;
    const user = context.switchToHttp().getRequest().user as JwtPayload | undefined;
    if (!user) return false;
    if (user.role === Role.SHOP_OWNER) return true;
    if (user.role !== Role.SHOP_STAFF || !user.shopId) return false;
    const row = await this.prisma.shopChair.findFirst({
      where: { shopId: user.shopId, staffUserId: user.sub, canAdmin: true },
      select: { id: true },
    });
    return !!row;
  }
}
