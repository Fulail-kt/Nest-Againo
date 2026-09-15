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
  createdAt: Date;
};

export function toPublicUser(user: {
  id: number;
  email: string;
  name: string;
  password: string;
  role: Role;
  status: MembershipStatus;
  gymId: number | null;
  shopId: number | null;
  phone?: string | null;
  fcmToken: string | null;
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
    createdAt: user.createdAt,
  };
}
