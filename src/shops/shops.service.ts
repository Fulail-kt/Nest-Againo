import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Role, ShopMemberRole } from '../../generated/prisma/client';
import type { JwtPayload } from '../auth/jwt-payload';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { CreateAppointmentDto, PatchAppointmentDto } from './dto/appointment.dto';
import { UpdateShopDto, UpsertChairDto, UpsertCustomerDto, UpsertServiceDto } from './dto/shop.dto';
import { remindAtFor } from './holiday';
import { PHOTO_CAP, assertPhoto, dropPhoto, savePhoto } from './photos';

const CHAIR_CAP = 5;
const chairList = {
  orderBy: [{ sort: 'asc' as const }, { id: 'asc' as const }],
  include: { staff: { select: { id: true, name: true, phone: true } } },
};

@Injectable()
export class ShopsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wa: WhatsAppService,
  ) {}

  async me(shopId: number, actor?: JwtPayload) {
    await this.ensureChairs(shopId);
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        chairs: chairList,
        _count: { select: { customers: true, services: true, appointments: true } },
      },
    });
    if (!shop) throw new NotFoundException('Shop not found');
    const next = await this.withUpcoming(shop);
    const canAdmin =
      actor?.role === Role.SHOP_OWNER ||
      next.chairs.some((c) => c.staffUserId === actor?.sub && c.canAdmin);
    return { ...next, canAdmin };
  }

  async update(shopId: number, dto: UpdateShopDto, actor?: JwtPayload) {
    const shop = await this.me(shopId, actor);
    const openHour = dto.openHour ?? shop.openHour;
    const closeHour = dto.closeHour ?? shop.closeHour;
    if (closeHour <= openHour) {
      throw new BadRequestException('Close hour must be after open hour.');
    }
    if (dto.closedWeekdays && new Set(dto.closedWeekdays).size !== dto.closedWeekdays.length) {
      throw new BadRequestException('Closed days must be unique.');
    }
    return {
      ...(await this.withUpcoming(
        await this.prisma.shop.update({
          where: { id: shopId },
          data: dto,
          include: { chairs: chairList },
        }),
      )),
      canAdmin: shop.canAdmin,
    };
  }

  listChairs(shopId: number) {
    return this.ensureChairs(shopId);
  }

  async createChair(shopId: number, dto: UpsertChairDto) {
    const chairs = await this.ensureChairs(shopId);
    if (chairs.length >= CHAIR_CAP) throw new BadRequestException('Max 5 chairs.');
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Chair name required.');
    const staff = staffFields(dto);
    if (staff.any) assertStaffComplete(staff, true);
    if (staff.phone) await this.assertPhoneFree(staff.phone);
    const sort = (chairs.at(-1)?.sort ?? -1) + 1;

    return this.prisma.$transaction(async (tx) => {
      const chair = await tx.shopChair.create({ data: { shopId, name, sort } });
      if (!staff.any) {
        return tx.shopChair.findFirstOrThrow({ where: { id: chair.id }, include: chairList.include });
      }
      const user = await tx.user.create({
        data: {
          email: staffEmail(shopId, staff.phone),
          name: staff.name,
          phone: staff.phone,
          password: await bcrypt.hash(staff.password, 10),
          role: Role.SHOP_STAFF,
          shopId,
        },
      });
      await tx.shopMember.create({
        data: { shopId, userId: user.id, role: ShopMemberRole.STAFF },
      });
      return tx.shopChair.update({
        where: { id: chair.id },
        data: { staffUserId: user.id, canAdmin: !!dto.canAdmin },
        include: chairList.include,
      });
    });
  }

  async updateChair(shopId: number, id: number, dto: UpsertChairDto, actor: JwtPayload) {
    const locked = await this.actorChairId(shopId, actor);
    if (locked && locked !== id) throw new ForbiddenException('Not your chair.');
    await this.assertChair(shopId, id);
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Chair name required.');
    const chairs = await this.ensureChairs(shopId);
    if (locked || nameOnlySeat(chairs, id, actor)) {
      return this.prisma.shopChair.update({
        where: { id },
        data: { name },
        include: chairList.include,
      });
    }

    const chair = await this.prisma.shopChair.findFirst({
      where: { id, shopId },
      include: { staff: true },
    });
    if (!chair) throw new NotFoundException('Chair not found');
    const staff = staffFields(dto);
    if (staff.any) {
      if (chair.staffUserId) {
        if (staff.phone) await this.assertPhoneFree(staff.phone, chair.staffUserId);
        await this.prisma.user.update({
          where: { id: chair.staffUserId },
          data: {
            ...(staff.name ? { name: staff.name } : {}),
            ...(staff.phone ? { phone: staff.phone, email: staffEmail(shopId, staff.phone) } : {}),
            ...(staff.password ? { password: await bcrypt.hash(staff.password, 10) } : {}),
          },
        });
      } else {
        assertStaffComplete(staff, true);
        await this.assertPhoneFree(staff.phone);
        const user = await this.prisma.user.create({
          data: {
            email: staffEmail(shopId, staff.phone),
            name: staff.name,
            phone: staff.phone,
            password: await bcrypt.hash(staff.password, 10),
            role: Role.SHOP_STAFF,
            shopId,
          },
        });
        await this.prisma.shopMember.create({
          data: { shopId, userId: user.id, role: ShopMemberRole.STAFF },
        });
        return this.prisma.shopChair.update({
          where: { id },
          data: { name, staffUserId: user.id, canAdmin: !!dto.canAdmin },
          include: chairList.include,
        });
      }
    }
    return this.prisma.shopChair.update({
      where: { id },
      data: {
        name,
        ...(dto.canAdmin === undefined
          ? {}
          : { canAdmin: !!(staff.any || chair.staffUserId) && !!dto.canAdmin }),
      },
      include: chairList.include,
    });
  }

  async removeChair(shopId: number, id: number, moveToChairId?: number, actor?: JwtPayload) {
    const chairs = await this.ensureChairs(shopId);
    if (chairs.length <= 1) throw new BadRequestException('Keep at least one chair.');
    const owner = ownerChairOf(chairs);
    if (owner && owner.id === id) {
      throw new BadRequestException('Owner chair cannot be deleted.');
    }
    const row = await this.assertChair(shopId, id);
    if (actor?.role === Role.SHOP_STAFF && row.staffUserId === actor.sub) {
      throw new ForbiddenException('Cannot remove your own chair.');
    }
    const keep = chairs.find((c) => c.id === moveToChairId);
    if (!keep || keep.id === id) {
      throw new BadRequestException('Pick another chair to take the bookings.');
    }
    await this.assertMoveClear(shopId, id, keep.id);
    const staffUserId = row.staffUserId;
    await this.prisma.$transaction(async (tx) => {
      await tx.shopAppointment.updateMany({
        where: { shopId, chairId: id },
        data: { chairId: keep.id },
      });
      await tx.shopCustomer.updateMany({
        where: { shopId, preferredChairId: id },
        data: { preferredChairId: keep.id },
      });
      const tagged = await tx.shopService.findMany({
        where: { shopId, chairIds: { has: id } },
        select: { id: true, chairIds: true },
      });
      await Promise.all(
        tagged.map((s) =>
          tx.shopService.update({
            where: { id: s.id },
            data: { chairIds: s.chairIds.filter((x) => x !== id) },
          }),
        ),
      );
      await tx.shopChair.update({ where: { id }, data: { staffUserId: null } });
      await tx.shopChair.delete({ where: { id } });
      if (staffUserId) {
        await tx.shopMember.deleteMany({ where: { shopId, userId: staffUserId } });
        await tx.user.delete({ where: { id: staffUserId } });
      }
    });
    return { ok: true };
  }

  async moveChairBookings(shopId: number, id: number, moveToChairId?: number) {
    const chairs = await this.ensureChairs(shopId);
    if (ownerChairOf(chairs)?.id === id) {
      throw new BadRequestException('Owner chair bookings stay here.');
    }
    const keep = chairs.find((c) => c.id === moveToChairId);
    if (!keep || keep.id === id) {
      throw new BadRequestException('Pick another chair to take the bookings.');
    }
    await this.assertChair(shopId, id);
    await this.assertMoveClear(shopId, id, keep.id);
    const moved = await this.prisma.shopAppointment.updateMany({
      where: { shopId, chairId: id },
      data: { chairId: keep.id },
    });
    await this.prisma.shopCustomer.updateMany({
      where: { shopId, preferredChairId: id },
      data: { preferredChairId: keep.id },
    });
    return { ok: true, moved: moved.count };
  }

  async listCustomers(shopId: number, q?: string) {
    const rows = await this.prisma.shopCustomer.findMany({
      where: {
        shopId,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      include: { _count: { select: { appointments: true } } },
    });
    return rows.map(({ _count, ...row }) => ({ ...row, hasHistory: _count.appointments > 0 }));
  }

  async createCustomer(shopId: number, dto: UpsertCustomerDto) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Shop not found');
    const { sendGreeting = true, followUpDays, ...fields } = dto;
    if (fields.preferredChairId != null) await this.assertChair(shopId, fields.preferredChairId);
    const days = followUpDays ?? shop.followUpDays;
    const followUpDueAt = addDays(new Date(), days);

    const row = await this.prisma.shopCustomer.create({
      data: { ...fields, shopId, followUpDays: days, followUpDueAt },
    });

    let greeting: { sent: boolean; reason: string | null } = {
      sent: false,
      reason: 'Skipped',
    };
    if (sendGreeting) {
      greeting = await this.wa.notifyGreeting(shopId, {
        phone: row.phone,
        customerName: row.name,
        shopName: shop.name,
      });
      if (greeting.sent) {
        await this.prisma.shopCustomer.update({
          where: { id: row.id },
          data: { lastMessagedAt: new Date() },
        });
      }
    }

    return { ...row, greeting };
  }

  async updateCustomer(shopId: number, id: number, dto: UpsertCustomerDto) {
    const row = await this.prisma.shopCustomer.findFirst({ where: { id, shopId } });
    if (!row) throw new NotFoundException('Customer not found');
    const { sendGreeting: _ignore, followUpDays, ...fields } = dto;
    if (fields.preferredChairId != null) await this.assertChair(shopId, fields.preferredChairId);
    const nextDays = followUpDays ?? row.followUpDays;
    const followUpDueAt = followUpDays
      ? addDays(row.lastVisitAt ?? row.createdAt, nextDays)
      : undefined;
    const next = await this.prisma.shopCustomer.update({
      where: { id },
      data: { ...fields, ...(followUpDays ? { followUpDays: nextDays, followUpDueAt } : {}) },
    });
    if (next.isActive === false) await this.hushApptReminders(shopId, { customerId: id });
    return next;
  }

  async getCustomer(shopId: number, id: number) {
    const row = await this.prisma.shopCustomer.findFirst({
      where: { id, shopId },
      include: {
        appointments: {
          orderBy: { startAt: 'desc' },
          take: 40,
          select: {
            id: true,
            startAt: true,
            endAt: true,
            status: true,
            chair: { select: { id: true, name: true } },
            service: { select: { name: true, price: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Customer not found');
    return row;
  }

  async removeCustomer(shopId: number, id: number) {
    const row = await this.prisma.shopCustomer.findFirst({
      where: { id, shopId },
      include: { _count: { select: { appointments: true } } },
    });
    if (!row) throw new NotFoundException('Customer not found');
    if (row._count.appointments > 0) {
      throw new BadRequestException('Has visit history. Disable instead of delete.');
    }
    for (const name of row.photos) await dropPhoto(shopId, id, name);
    await this.prisma.shopCustomer.delete({ where: { id } });
    return { ok: true };
  }

  async addCustomerPhoto(
    shopId: number,
    id: number,
    file?: { mimetype?: string; size?: number; buffer?: Buffer },
  ) {
    assertPhoto(file);
    const row = await this.prisma.shopCustomer.findFirst({ where: { id, shopId } });
    if (!row) throw new NotFoundException('Customer not found');
    const name = await savePhoto(shopId, id, { mimetype: file!.mimetype!, buffer: file!.buffer! });
    const photos = [...row.photos];
    if (photos.length >= PHOTO_CAP) {
      const old = photos.shift();
      if (old) await dropPhoto(shopId, id, old);
    }
    photos.push(name);
    return this.prisma.shopCustomer.update({
      where: { id },
      data: { photos },
      select: { id: true, photos: true },
    });
  }

  async removeCustomerPhoto(shopId: number, id: number, file: string) {
    const row = await this.prisma.shopCustomer.findFirst({ where: { id, shopId } });
    if (!row) throw new NotFoundException('Customer not found');
    if (!row.photos.includes(file)) throw new NotFoundException('Photo not found');
    await dropPhoto(shopId, id, file);
    return this.prisma.shopCustomer.update({
      where: { id },
      data: { photos: row.photos.filter((p) => p !== file) },
      select: { id: true, photos: true },
    });
  }

  async listServices(shopId: number) {
    const rows = await this.prisma.shopService.findMany({
      where: { shopId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { appointments: true } } },
    });
    return rows.map(({ _count, ...row }) => ({ ...row, hasHistory: _count.appointments > 0 }));
  }

  async createService(shopId: number, dto: UpsertServiceDto) {
    return this.prisma.shopService.create({
      data: {
        shopId,
        name: dto.name,
        durationMinutes: dto.durationMinutes,
        price: dto.price,
        chairIds: await this.normalizeChairIds(shopId, dto.chairIds),
      },
    });
  }

  async updateService(shopId: number, id: number, dto: UpsertServiceDto) {
    const row = await this.prisma.shopService.findFirst({ where: { id, shopId } });
    if (!row) throw new NotFoundException('Service not found');
    const next = await this.prisma.shopService.update({
      where: { id },
      data: {
        name: dto.name,
        durationMinutes: dto.durationMinutes,
        price: dto.price,
        ...(dto.chairIds !== undefined
          ? { chairIds: await this.normalizeChairIds(shopId, dto.chairIds) }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    if (next.isActive === false) await this.hushApptReminders(shopId, { serviceId: id });
    return next;
  }

  async removeService(shopId: number, id: number) {
    const row = await this.prisma.shopService.findFirst({
      where: { id, shopId },
      include: { _count: { select: { appointments: true } } },
    });
    if (!row) throw new NotFoundException('Service not found');
    if (row._count.appointments > 0) {
      throw new BadRequestException('Has booking history. Disable instead of delete.');
    }
    await this.prisma.shopService.delete({ where: { id } });
    return { ok: true };
  }

  private hushApptReminders(shopId: number, where: { customerId?: number; serviceId?: number }) {
    return this.prisma.shopAppointment.updateMany({
      where: { shopId, status: 'BOOKED', ...where, remindAt: { not: null } },
      data: { remindAt: null },
    });
  }

  async listAppointments(shopId: number, from?: string, to?: string, actor?: JwtPayload, older?: boolean) {
    const start = from ? parseStart(from) : startOfDay();
    const end = to ? parseStart(to) : endOfDay();
    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException('Invalid date range');
    }
    const locked = await this.actorChairId(shopId, actor);
    const scope = { shopId, ...(locked ? { chairId: locked } : {}) };
    const items = await this.prisma.shopAppointment.findMany({
      where: { ...scope, startAt: { gte: start, lt: end } },
      include: { customer: true, service: true, chair: true },
      orderBy: { startAt: 'asc' },
    });
    if (!older) return items;
    const prior = await this.prisma.shopAppointment.findFirst({
      where: { ...scope, startAt: { lt: start } },
      select: { id: true },
    });
    return { items, hasOlder: !!prior };
  }

  async createAppointment(shopId: number, dto: CreateAppointmentDto, actor?: JwtPayload) {
    const [customer, service, shop] = await Promise.all([
      this.prisma.shopCustomer.findFirst({ where: { id: dto.customerId, shopId } }),
      this.prisma.shopService.findFirst({ where: { id: dto.serviceId, shopId } }),
      this.prisma.shop.findUnique({ where: { id: shopId } }),
    ]);
    if (!customer) throw new NotFoundException('Customer not found');
    if (!customer.isActive) throw new BadRequestException('Client is disabled');
    if (!service) throw new NotFoundException('Service not found');
    if (!service.isActive) throw new BadRequestException('Service is disabled');
    if (!shop) throw new NotFoundException('Shop not found');

    const startAt = parseStart(dto.startAt);
    assertFuture(startAt);
    const mins = dto.durationMinutes && dto.durationMinutes >= 5 ? dto.durationMinutes : service.durationMinutes;
    const endAt = new Date(startAt.getTime() + mins * 60_000);
    assertOpen(shop, startAt, endAt);
    const locked = await this.actorChairId(shopId, actor);
    const chairId = await this.resolveChair(shopId, startAt, endAt, {
      chairId: locked ?? dto.chairId,
      preferredChairId: locked ? null : customer.preferredChairId,
      onlyChairIds: service.chairIds,
    });

    const row = await this.prisma.shopAppointment.create({
      data: {
        shopId,
        customerId: customer.id,
        serviceId: service.id,
        chairId,
        startAt,
        endAt,
        status: 'BOOKED',
        source: 'STAFF',
        remindAt: remindAtFor(startAt, shop),
      },
      include: { customer: true, service: true, chair: true },
    });

    void this.wa.notifyAppointment(shopId, {
      kind: 'appointment_confirmation',
      phone: customer.phone,
      customerName: customer.name,
      serviceName: service.name,
      when: startAt.toLocaleString(),
      shopName: shop.name,
    });

    return row;
  }

  async patchAppointment(shopId: number, id: number, dto: PatchAppointmentDto, actor?: JwtPayload) {
    const row = await this.prisma.shopAppointment.findFirst({
      where: { id, shopId },
      include: { customer: true, service: true },
    });
    if (!row) throw new NotFoundException('Appointment not found');
    const locked = await this.actorChairId(shopId, actor);
    if (locked && row.chairId !== locked) throw new ForbiddenException('Not your chair.');

    let customerId = row.customerId;
    let serviceId = row.serviceId;
    let chairId = row.chairId;
    let startAt = row.startAt;
    let service = row.service;

    if (dto.customerId) {
      const customer = await this.prisma.shopCustomer.findFirst({
        where: { id: dto.customerId, shopId },
      });
      if (!customer) throw new NotFoundException('Customer not found');
      if (!customer.isActive && customer.id !== row.customerId) {
        throw new BadRequestException('Client is disabled');
      }
      customerId = customer.id;
    }
    if (dto.serviceId) {
      const nextService = await this.prisma.shopService.findFirst({
        where: { id: dto.serviceId, shopId },
      });
      if (!nextService) throw new NotFoundException('Service not found');
      if (!nextService.isActive && nextService.id !== row.serviceId) {
        throw new BadRequestException('Service is disabled');
      }
      service = nextService;
      serviceId = nextService.id;
    }
    if (dto.startAt) {
      startAt = parseStart(dto.startAt);
      assertFuture(startAt, 'Cannot move a booking to a past time.');
    }
    if (dto.chairId) {
      if (locked && dto.chairId !== locked) throw new ForbiddenException('Not your chair.');
      await this.assertChair(shopId, dto.chairId);
      chairId = dto.chairId;
    }

    if (dto.status === 'COMPLETED' || dto.status === 'NO_SHOW') {
      if (row.status === 'CANCELLED') {
        throw new BadRequestException('Cancelled booking cannot be marked done or no-show.');
      }
      if (row.startAt.getTime() > Date.now()) {
        throw new BadRequestException(
          dto.status === 'COMPLETED'
            ? 'Cannot mark a future booking done.'
            : 'Cannot mark a future booking as missed.',
        );
      }
    }

    const mins =
      dto.durationMinutes && dto.durationMinutes >= 5
        ? dto.durationMinutes
        : Math.round((row.endAt.getTime() - row.startAt.getTime()) / 60_000) || service.durationMinutes;
    const endAt = new Date(startAt.getTime() + mins * 60_000);
    if ((dto.serviceId || dto.chairId) && service.chairIds.length && !service.chairIds.includes(chairId)) {
      throw new BadRequestException('This service is not for that chair.');
    }

    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (dto.startAt || dto.serviceId || dto.durationMinutes || dto.customerId || dto.chairId) {
      if (shop) assertOpen(shop, startAt, endAt);
      await this.assertFree(shopId, startAt, endAt, chairId, id);
    }

    let loyaltyAwarded: number | undefined;
    let loyaltyStreak = false;

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.shopAppointment.update({
        where: { id },
        data: {
          customerId,
          serviceId,
          chairId,
          startAt,
          endAt,
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.status && dto.status !== 'BOOKED'
            ? { remindAt: null }
            : dto.startAt
              ? { remindAt: remindAtFor(startAt, shop ?? { openHour: 9, closedWeekdays: [] }) }
              : {}),
        },
        include: { customer: true, service: true, chair: true },
      });
      if (dto.status === 'COMPLETED' && row.status !== 'COMPLETED') {
        const now = new Date();
        loyaltyStreak =
          !!row.customer.lastVisitAt &&
          !!row.customer.followUpDueAt &&
          now.getTime() <= row.customer.followUpDueAt.getTime();
        loyaltyAwarded = loyaltyStreak ? 20 : 10;
        await tx.shopCustomer.update({
          where: { id: next.customerId },
          data: {
            lastVisitAt: now,
            loyaltyPoints: { increment: loyaltyAwarded },
            followUpDueAt: addDays(now, next.customer.followUpDays),
          },
        });
      }
      return next;
    });

    const waOk = updated.customer.isActive !== false && updated.service.isActive !== false;
    if (waOk && dto.status === 'CANCELLED' && row.status === 'BOOKED') {
      const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
      void this.wa.notifyAppointment(shopId, {
        kind: 'appointment_cancellation',
        phone: row.customer.phone,
        customerName: row.customer.name,
        serviceName: row.service.name,
        when: row.startAt.toLocaleString(),
        shopName: shop?.name ?? 'Shop',
      });
    } else if (waOk && dto.startAt && row.status === 'BOOKED' && startAt.getTime() !== row.startAt.getTime()) {
      const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
      void this.wa.notifyAppointment(shopId, {
        kind: 'appointment_reschedule',
        phone: updated.customer.phone,
        customerName: updated.customer.name,
        serviceName: updated.service.name,
        when: startAt.toLocaleString(),
        shopName: shop?.name ?? 'Shop',
      });
    }

    if (loyaltyAwarded) {
      return { ...updated, loyaltyAwarded, loyaltyStreak };
    }
    return updated;
  }

  private async ensureChairs(shopId: number) {
    const existing = await this.prisma.shopChair.findMany({
      where: { shopId },
      ...chairList,
    });
    if (existing.length) return existing;
    await this.prisma.shopChair.create({
      data: { shopId, name: 'Chair 1', sort: 0 },
    });
    return this.prisma.shopChair.findMany({ where: { shopId }, ...chairList });
  }

  private async actorChairId(shopId: number, actor?: JwtPayload) {
    if (!actor || actor.role !== Role.SHOP_STAFF) return null;
    const ch = await this.prisma.shopChair.findFirst({
      where: { shopId, staffUserId: actor.sub },
    });
    if (!ch) throw new ForbiddenException('No chair assigned');
    return ch.canAdmin ? null : ch.id;
  }

  private async assertPhoneFree(phone: string, exceptUserId?: number) {
    const row = await this.prisma.user.findFirst({
      where: { phone, ...(exceptUserId ? { id: { not: exceptUserId } } : {}) },
    });
    if (row) throw new ConflictException('Phone already used.');
  }

  private async withUpcoming<T extends { id: number; chairs: { id: number }[] }>(shop: T) {
    const rows = await this.prisma.shopAppointment.groupBy({
      by: ['chairId'],
      where: { shopId: shop.id, status: 'BOOKED', startAt: { gt: new Date() } },
      _count: { _all: true },
    });
    const map = new Map(rows.map((r) => [r.chairId, r._count._all]));
    return {
      ...shop,
      chairs: shop.chairs.map((c) => ({ ...c, upcoming: map.get(c.id) ?? 0 })),
    };
  }

  private async assertMoveClear(shopId: number, fromId: number, toId: number) {
    const [src, dest] = await Promise.all([
      this.prisma.shopAppointment.findMany({
        where: { shopId, chairId: fromId, status: 'BOOKED', startAt: { gt: new Date() } },
        include: { customer: { select: { name: true } } },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.shopAppointment.findMany({
        where: { shopId, chairId: toId, status: 'BOOKED', startAt: { gt: new Date() } },
        include: { customer: { select: { name: true } } },
      }),
    ]);
    const conflicts = src.flatMap((a) => {
      const hit = dest.find((d) => d.startAt < a.endAt && d.endAt > a.startAt);
      if (!hit) return [];
      return [
        {
          startAt: a.startAt,
          endAt: a.endAt,
          fromName: a.customer.name,
          toName: hit.customer.name,
        },
      ];
    });
    if (!conflicts.length) return;
    throw new HttpException(
      { message: 'Fix overlapping times first.', conflicts },
      HttpStatus.CONFLICT,
    );
  }

  private async assertChair(shopId: number, chairId: number) {
    const row = await this.prisma.shopChair.findFirst({ where: { id: chairId, shopId } });
    if (!row) throw new NotFoundException('Chair not found');
    return row;
  }

  private async normalizeChairIds(shopId: number, ids?: number[]) {
    if (!ids?.length) return [] as number[];
    const ok = new Set((await this.ensureChairs(shopId)).map((c) => c.id));
    const next = [...new Set(ids)];
    if (next.some((id) => !ok.has(id))) throw new BadRequestException('Unknown chair.');
    return next;
  }

  private async resolveChair(
    shopId: number,
    startAt: Date,
    endAt: Date,
    opts: { chairId?: number; preferredChairId?: number | null; exceptId?: number; onlyChairIds?: number[] },
  ) {
    const chairs = await this.ensureChairs(shopId);
    const pool = opts.onlyChairIds?.length
      ? chairs.filter((c) => opts.onlyChairIds!.includes(c.id))
      : chairs;
    if (!pool.length) throw new BadRequestException('This service is not offered by any chair.');
    if (opts.chairId) {
      if (!pool.some((c) => c.id === opts.chairId)) {
        throw new BadRequestException('This service is not for that chair.');
      }
      await this.assertFree(shopId, startAt, endAt, opts.chairId, opts.exceptId);
      return opts.chairId;
    }
    const prefer = opts.preferredChairId;
    const ordered =
      prefer && pool.some((c) => c.id === prefer)
        ? [pool.find((c) => c.id === prefer)!, ...pool.filter((c) => c.id !== prefer)]
        : pool;
    for (const ch of ordered) {
      const clash = await this.findClash(shopId, startAt, endAt, ch.id, opts.exceptId);
      if (!clash) return ch.id;
    }
    throw new BadRequestException('All chairs busy that time.');
  }

  private async findClash(
    shopId: number,
    startAt: Date,
    endAt: Date,
    chairId: number,
    exceptId?: number,
  ) {
    return this.prisma.shopAppointment.findFirst({
      where: {
        shopId,
        chairId,
        status: 'BOOKED',
        startAt: { lt: endAt },
        endAt: { gt: startAt },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });
  }

  private async assertFree(
    shopId: number,
    startAt: Date,
    endAt: Date,
    chairId: number,
    exceptId?: number,
  ) {
    const clash = await this.findClash(shopId, startAt, endAt, chairId, exceptId);
    if (clash) throw new BadRequestException('That slot overlaps another booking on this chair.');
  }
}

function ownerChairOf<T extends { id: number; sort: number; staffUserId?: number | null }>(chairs: T[]) {
  return [...chairs].sort((a, b) => a.sort - b.sort || a.id - b.id)[0] ?? null;
}

function nameOnlySeat(
  chairs: { id: number; sort: number; staffUserId?: number | null }[],
  id: number,
  actor: JwtPayload,
) {
  if (ownerChairOf(chairs)?.id === id) return true;
  return actor.role === Role.SHOP_STAFF && chairs.some((c) => c.id === id && c.staffUserId === actor.sub);
}

function staffFields(dto: UpsertChairDto) {
  const name = dto.staffName?.trim() ?? '';
  const phone = (dto.staffPhone ?? '').replace(/\D/g, '');
  const password = dto.staffPassword ?? '';
  return { name, phone, password, any: !!(name || phone || password) };
}

function assertStaffComplete(
  staff: { name: string; phone: string; password: string },
  needPassword: boolean,
) {
  if (staff.name.length < 2 || staff.phone.length < 10 || (needPassword && staff.password.length < 6)) {
    throw new BadRequestException('Staff needs name, phone, and password.');
  }
}

function staffEmail(shopId: number, phone: string) {
  return `s${shopId}.${phone}@staff.local`;
}

function assertOpen(
  shop: { openHour: number; closeHour: number; closedWeekdays: number[] },
  startAt: Date,
  endAt: Date,
) {
  if (shop.closedWeekdays.includes(startAt.getDay())) {
    throw new BadRequestException('Shop is closed that day.');
  }
  const open = new Date(startAt);
  open.setHours(shop.openHour, 0, 0, 0);
  const close = new Date(startAt);
  close.setHours(shop.closeHour, 0, 0, 0);
  if (startAt.getTime() < open.getTime() || endAt.getTime() > close.getTime()) {
    throw new BadRequestException(
      `Bookings must sit inside ${pad(shop.openHour)}:00–${pad(shop.closeHour)}:00.`,
    );
  }
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function parseStart(raw: string) {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid start time');
  return d;
}

function assertFuture(startAt: Date, message = 'Cannot book a past time.') {
  if (startAt.getTime() <= Date.now()) throw new BadRequestException(message);
}

function addDays(from: Date, days: number) {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay() {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d;
}

