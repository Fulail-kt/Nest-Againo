import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { MembershipStatus, Role, ShopMemberRole } from '../../generated/prisma/client';
import { toPublicUser } from '../common/to-public-user';
import { PrismaService } from '../prisma/prisma.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterAdminDto } from './dto/register-admin.dto';
import { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './jwt-payload';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async registerAdmin(dto: RegisterAdminDto): Promise<AuthResponseDto> {
    await this.assertEmailFree(dto.email);
    const kind = dto.kind ?? 'GYM';
    const businessName = (dto.businessName || dto.gymName || '').trim();
    if (businessName.length < 2) {
      throw new BadRequestException('Business name required');
    }

    if (kind === 'BARBER') {
      const user = await this.prisma.$transaction(async (tx) => {
        const shop = await tx.shop.create({ data: { name: businessName } });
        await tx.shopChair.create({ data: { shopId: shop.id, name: 'Chair 1', sort: 0 } });
        const created = await tx.user.create({
          data: {
            email: dto.email,
            name: dto.name,
            password: await bcrypt.hash(dto.password, 10),
            role: Role.SHOP_OWNER,
            shopId: shop.id,
          },
        });
        await tx.shopMember.create({
          data: { shopId: shop.id, userId: created.id, role: ShopMemberRole.OWNER },
        });
        return created;
      });
      return this.toAuthResponse(user);
    }

    const code = await this.uniqueGymCode();
    const user = await this.prisma.$transaction(async (tx) => {
      const gym = await tx.gym.create({
        data: { name: businessName, code },
      });
      return tx.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          password: await bcrypt.hash(dto.password, 10),
          role: Role.GYM_ADMIN,
          gymId: gym.id,
        },
      });
    });

    return this.toAuthResponse(user);
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    await this.assertEmailFree(dto.email);
    const gym = await this.prisma.gym.findUnique({
      where: { code: dto.gymCode.trim().toUpperCase() },
    });
    if (!gym) {
      throw new NotFoundException('Invalid gym code');
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: await bcrypt.hash(dto.password, 10),
        role: Role.MEMBER,
        gymId: gym.id,
      },
    });

    return this.toAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const ident = dto.email.trim();
    const digits = ident.replace(/\D/g, '');
    const user = ident.includes('@')
      ? await this.prisma.user.findUnique({ where: { email: ident } })
      : await this.prisma.user.findFirst({ where: { phone: digits } });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid email, phone, or password');
    }
    if (user.status === MembershipStatus.INACTIVE) {
      throw new UnauthorizedException('Account is deactivated');
    }

    return this.toAuthResponse(user);
  }

  async me(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return toPublicUser(user);
  }

  private async assertEmailFree(email: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
  }

  private async uniqueGymCode(): Promise<string> {
    for (let i = 0; i < 8; i++) {
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      const taken = await this.prisma.gym.findUnique({ where: { code } });
      if (!taken) {
        return code;
      }
    }
    return `G${Date.now().toString(36).toUpperCase().slice(-5)}`;
  }

  private async toAuthResponse(user: {
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
  }): Promise<AuthResponseDto> {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      gymId: user.gymId,
      shopId: user.shopId,
      status: user.status,
    } satisfies JwtPayload);

    return { accessToken, user: toPublicUser(user) };
  }
}
