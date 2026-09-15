import { MembershipStatus, Role } from '../../generated/prisma/client';

export type JwtPayload = {
  sub: number;
  email: string;
  role: Role;
  gymId: number | null;
  shopId: number | null;
  status: MembershipStatus;
};
