import { ForbiddenException } from '@nestjs/common';
import type { JwtPayload } from '../auth/jwt-payload';

export function requireShopId(user: JwtPayload): number {
  if (!user.shopId) {
    throw new ForbiddenException('No shop assigned');
  }
  return user.shopId;
}
