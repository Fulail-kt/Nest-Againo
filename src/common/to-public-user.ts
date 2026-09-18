import { MembershipStatus, Role } from '../../generated/prisma/client';

export type PublicUser = {
  id: number;
  email: string;
  name: string;
  role: Role;
  status: MembershipStatus;
  gymId: number | null;
  shopId: number | null;
  phone: string | null;
  emailVerified: boolean;
  needsOnboarding: boolean;
  createdAt: Date;
};

export function toPublicUser(user: {
  id: number;
  email: string;
  name: string;
  role: Role;
  status: MembershipStatus;
  gymId: number | null;
  shopId: number | null;
  phone?: string | null;
  emailVerifiedAt?: Date | null;
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    gymId: user.gymId,
    shopId: user.shopId,
    phone: user.phone ?? null,
    emailVerified: !!user.emailVerifiedAt,
    needsOnboarding: user.role === Role.OWNER,
    createdAt: user.createdAt,
  };
}
