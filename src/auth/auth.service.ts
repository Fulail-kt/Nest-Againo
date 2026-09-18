import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt } from 'crypto';
import {
  MembershipStatus,
  Prisma,
  Role,
  ShopMemberRole,
  type User,
} from '../../generated/prisma/client';
import { toPublicUser } from '../common/to-public-user';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { OnboardingDto } from './dto/onboarding.dto';
import { RegisterAdminDto } from './dto/register-admin.dto';
import { RegisterDto } from './dto/register.dto';
import { verifyGoogleIdToken } from './google-token';
import type { JwtPayload } from './jwt-payload';

const VERIFY_TTL_MS = 15 * 60 * 1000;
const RESEND_GAP_MS = 60 * 1000;

function hashVerifyCode(email: string, code: string) {
  return createHash('sha256').update(`${email.toLowerCase()}:${code}`).digest('hex');
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly log = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  async onModuleInit() {
    await this.ensureSuperAdmin();
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    await this.assertEmailFree(dto.email);
    const code = String(randomInt(100000, 1000000));
    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          email: dto.email.trim().toLowerCase(),
          name: dto.name.trim(),
          password: await bcrypt.hash(dto.password, 10),
          role: Role.OWNER,
          verifyCodeHash: hashVerifyCode(dto.email, code),
          verifyCodeExpires: new Date(Date.now() + VERIFY_TTL_MS),
        },
      });
    } catch (e) {
      this.throwIfEmailTaken(e);
    }
    try {
      await this.mail.sendVerifyCode(user.email, code);
    } catch (e) {
      this.log.error(`Verify email send failed: ${e instanceof Error ? e.message : e}`);
    }
    return this.toAuthResponse(user);
  }

  async registerAdmin(dto: RegisterAdminDto): Promise<AuthResponseDto> {
    await this.assertEmailFree(dto.email);
    const kind = dto.kind ?? 'GYM';
    const businessName = (dto.businessName || dto.gymName || '').trim();
    if (businessName.length < 2) {
      throw new BadRequestException('Enter a company name');
    }
    const password = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.$transaction((tx: Prisma.TransactionClient) =>
      this.provisionOwner(tx, {
        email: dto.email,
        name: dto.name,
        password,
        kind,
        companyName: businessName,
      }),
    );
    return this.toAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const ident = dto.email.trim();
    const digits = ident.replace(/\D/g, '');
    const user = ident.includes('@')
      ? ((await this.prisma.user.findUnique({ where: { email: ident } })) ??
        (await this.prisma.user.findUnique({ where: { email: ident.toLowerCase() } })))
      : await this.prisma.user.findFirst({ where: { phone: digits } });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Wrong email, phone, or password');
    }
    if (user.status === MembershipStatus.INACTIVE) {
      throw new UnauthorizedException('This account is turned off.');
    }

    return this.toAuthResponse(user);
  }

  async google(dto: GoogleAuthDto): Promise<AuthResponseDto> {
    const profile = await verifyGoogleIdToken(dto.idToken);
    const existing =
      (await this.prisma.user.findUnique({ where: { googleId: profile.googleId } })) ??
      (await this.prisma.user.findUnique({ where: { email: profile.email } }));

    if (existing) {
      if (existing.status === MembershipStatus.INACTIVE) {
        throw new UnauthorizedException('This account is turned off.');
      }
      if (existing.role === Role.MEMBER || existing.role === Role.SHOP_STAFF) {
        throw new ConflictException('That email is already used by a staff or member login.');
      }
      const user = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          googleId: existing.googleId ?? profile.googleId,
          emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
          verifyCodeHash: null,
          verifyCodeExpires: null,
        },
      });
      return this.toAuthResponse(user);
    }

    const user = await this.prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name,
        password: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
        role: Role.OWNER,
        googleId: profile.googleId,
        emailVerifiedAt: new Date(),
      },
    }).catch((e) => this.throwIfEmailTaken(e));
    return this.toAuthResponse(user);
  }

  async verifyEmail(payload: JwtPayload, code: string): Promise<AuthResponseDto> {
    const user = await this.requireUser(payload.sub);
    if (user.emailVerifiedAt) {
      return this.toAuthResponse(user);
    }
    if (
      !user.verifyCodeHash ||
      !user.verifyCodeExpires ||
      user.verifyCodeExpires.getTime() < Date.now()
    ) {
      throw new BadRequestException('That code expired. Tap Resend.');
    }
    if (user.verifyCodeHash !== hashVerifyCode(user.email, code)) {
      throw new BadRequestException('That code is wrong.');
    }
    const next = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        verifyCodeHash: null,
        verifyCodeExpires: null,
      },
    });
    return this.toAuthResponse(next);
  }

  async resendVerify(payload: JwtPayload) {
    const user = await this.requireUser(payload.sub);
    if (user.emailVerifiedAt) {
      return { ok: true as const };
    }
    if (
      user.verifyCodeExpires &&
      user.verifyCodeExpires.getTime() - Date.now() > VERIFY_TTL_MS - RESEND_GAP_MS
    ) {
      throw new BadRequestException('Wait a minute, then tap Resend.');
    }
    const code = String(randomInt(100000, 1000000));
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verifyCodeHash: hashVerifyCode(user.email, code),
        verifyCodeExpires: new Date(Date.now() + VERIFY_TTL_MS),
      },
    });
    await this.mail.sendVerifyCode(user.email, code);
    return { ok: true as const };
  }

  async onboard(payload: JwtPayload, dto: OnboardingDto): Promise<AuthResponseDto> {
    const user = await this.requireUser(payload.sub);
    if (!user.emailVerifiedAt) {
      throw new BadRequestException('Verify your email first');
    }
    if (user.role !== Role.OWNER || user.gymId || user.shopId) {
      throw new BadRequestException('Onboarding already complete');
    }
    const companyName = dto.companyName.trim();
    const next = await this.prisma.$transaction((tx: Prisma.TransactionClient) =>
      this.attachBusiness(tx, user, dto.kind, companyName),
    );
    return this.toAuthResponse(next);
  }

  async me(payload: JwtPayload) {
    return toPublicUser(await this.requireUser(payload.sub));
  }

  private async provisionOwner(
    tx: Prisma.TransactionClient,
    input: {
      email: string;
      name: string;
      password: string;
      kind: 'GYM' | 'BARBER';
      companyName: string;
    },
  ) {
    if (input.kind === 'BARBER') {
      const shop = await tx.shop.create({ data: { name: input.companyName } });
      await tx.shopChair.create({ data: { shopId: shop.id, name: 'Chair 1', sort: 0 } });
      const created = await tx.user.create({
        data: {
          email: input.email.trim().toLowerCase(),
          name: input.name.trim(),
          password: input.password,
          role: Role.SHOP_OWNER,
          shopId: shop.id,
          emailVerifiedAt: new Date(),
        },
      });
      await tx.shopMember.create({
        data: { shopId: shop.id, userId: created.id, role: ShopMemberRole.OWNER },
      });
      return created;
    }

    const gym = await tx.gym.create({
      data: { name: input.companyName, code: await this.uniqueGymCode(tx) },
    });
    return tx.user.create({
      data: {
        email: input.email.trim().toLowerCase(),
        name: input.name.trim(),
        password: input.password,
        role: Role.GYM_ADMIN,
        gymId: gym.id,
        emailVerifiedAt: new Date(),
      },
    });
  }

  private async attachBusiness(
    tx: Prisma.TransactionClient,
    user: User,
    kind: 'GYM' | 'BARBER',
    companyName: string,
  ) {
    if (kind === 'BARBER') {
      const shop = await tx.shop.create({ data: { name: companyName } });
      await tx.shopChair.create({ data: { shopId: shop.id, name: 'Chair 1', sort: 0 } });
      await tx.shopMember.create({
        data: { shopId: shop.id, userId: user.id, role: ShopMemberRole.OWNER },
      });
      return tx.user.update({
        where: { id: user.id },
        data: { role: Role.SHOP_OWNER, shopId: shop.id },
      });
    }
    const gym = await tx.gym.create({
      data: { name: companyName, code: await this.uniqueGymCode(tx) },
    });
    return tx.user.update({
      where: { id: user.id },
      data: { role: Role.GYM_ADMIN, gymId: gym.id },
    });
  }

  private async ensureSuperAdmin() {
    const email = 'admin@againo.com';
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.role !== Role.SUPER_ADMIN) {
        this.log.warn(`${email} exists as ${existing.role} — not overwriting`);
      }
      return;
    }
    await this.prisma.user.create({
      data: {
        email,
        name: 'Super Admin',
        password: await bcrypt.hash('admin@123', 10),
        role: Role.SUPER_ADMIN,
        emailVerifiedAt: new Date(),
      },
    });
    this.log.log(`Created SUPER_ADMIN ${email}`);
  }

  private throwIfEmailTaken(e: unknown): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictException('That email already has an account. Sign in instead.');
    }
    throw e;
  }

  private async requireUser(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new UnauthorizedException('Please sign in again.');
    return user;
  }

  private async assertEmailFree(email: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('That email already has an account. Sign in instead.');
    }
  }

  private async uniqueGymCode(
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<string> {
    for (let i = 0; i < 8; i++) {
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      const taken = await db.gym.findUnique({ where: { code } });
      if (!taken) return code;
    }
    return `G${Date.now().toString(36).toUpperCase().slice(-5)}`;
  }

  private async toAuthResponse(user: User): Promise<AuthResponseDto> {
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
