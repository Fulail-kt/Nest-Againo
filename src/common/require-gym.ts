import { ForbiddenException } from '@nestjs/common';
import type { JwtPayload } from '../auth/jwt-payload';

export function requireGymId(user: JwtPayload): number {
  if (!user.gymId) {
    throw new ForbiddenException('No gym assigned');
  }
  return user.gymId;
}
