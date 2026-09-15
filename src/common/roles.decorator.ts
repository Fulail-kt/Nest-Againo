import { SetMetadata } from '@nestjs/common';
import { Role } from '../../generated/prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const SHOP_ADMIN_KEY = 'shopAdmin';
export const ShopAdmin = () => SetMetadata(SHOP_ADMIN_KEY, true);
