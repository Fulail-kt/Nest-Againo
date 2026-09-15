import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { isShopHoliday, nextOpenDay, remindAtFor } from './holiday';

@Injectable()
export class ReminderService {
  private readonly log = new Logger(ReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wa: WhatsAppService,
  ) {}

  @Cron('*/15 * * * *')
  async tick() {
    const live = { customer: { isActive: true }, service: { isActive: true } };
    const unset = await this.prisma.shopAppointment.findMany({
      where: { status: 'BOOKED', remindAt: null, startAt: { gt: new Date() }, ...live },
      include: { shop: true },
      take: 80,
    });
    for (const row of unset) {
      await this.prisma.shopAppointment.update({
        where: { id: row.id },
        data: { remindAt: remindAtFor(row.startAt, row.shop) },
      });
    }

    const due = await this.prisma.shopAppointment.findMany({
      where: {
        status: 'BOOKED',
        remindAt: { lte: new Date() },
        ...live,
      },
      include: {
        shop: true,
        customer: true,
        service: true,
      },
      take: 80,
    });

    for (const row of due) {
      try {
        await this.handle(row);
      } catch (e) {
        this.log.warn(`remind ${row.id}: ${e instanceof Error ? e.message : 'fail'}`);
      }
    }
  }

  private async handle(row: {
    id: number;
    shopId: number;
    startAt: Date;
    remindAt: Date | null;
    shop: { name: string; closedWeekdays: number[]; timezone: string };
    customer: { phone: string; name: string };
    service: { name: string };
  }) {
    const tz = row.shop.timezone || 'Asia/Kolkata';
    const when = row.remindAt ?? new Date();
    if (isShopHoliday(when, row.shop.closedWeekdays ?? [], tz)) {
      const next = nextOpenDay(new Date(when.getTime() + 24 * 60 * 60 * 1000), row.shop.closedWeekdays ?? [], tz);
      await this.prisma.shopAppointment.update({
        where: { id: row.id },
        data: { remindAt: next },
      });
      this.log.log(`appt ${row.id} holiday → remind ${next.toISOString()}`);
      return;
    }

    if (row.startAt.getTime() + 2 * 60 * 60 * 1000 < Date.now()) {
      await this.prisma.shopAppointment.update({ where: { id: row.id }, data: { remindAt: null } });
      return;
    }

    await this.wa.notifyAppointment(row.shopId, {
      kind: 'appointment_reminder',
      phone: row.customer.phone,
      customerName: row.customer.name,
      serviceName: row.service.name,
      when: row.startAt.toLocaleString('en-IN', { timeZone: tz }),
      shopName: row.shop.name,
    });
    await this.prisma.shopAppointment.update({ where: { id: row.id }, data: { remindAt: null } });
  }
}
