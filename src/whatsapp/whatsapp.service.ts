import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret, encryptSecret } from '../common/secret';
import { toE164 } from '../common/phone';
import { metaConfig, metaReady } from './meta.config';
import {
  discoverAssets,
  exchangeCode,
  fetchPhone,
  fetchWaba,
  MetaApiError,
  sendWhatsApp,
  subscribeWaba,
} from './meta.client';
import { embeddedSignupHtml } from './signup.html';
import { verifyMetaSignature } from './webhook.util';

export type NotifyKind =
  | 'appointment_confirmation'
  | 'appointment_reminder'
  | 'appointment_cancellation'
  | 'appointment_reschedule';

@Injectable()
export class WhatsAppService {
  private readonly log = new Logger(WhatsAppService.name);

  constructor(private readonly prisma: PrismaService) {}

  status(shopId: number) {
    return this.publicOf(shopId);
  }

  async connect(shopId: number, userId: number) {
    if (!metaReady()) {
      throw new ServiceUnavailableException(
        'WhatsApp is not configured on this server. Set META_APP_ID, META_APP_SECRET, and META_CONFIG_ID.',
      );
    }
    const { appId, configId, graphVersion, publicBase } = metaConfig();
    const ticket = randomBytes(24).toString('hex');
    const ticketExpiresAt = new Date(Date.now() + 45 * 60 * 1000);
    await this.prisma.whatsappIntegration.upsert({
      where: { shopId },
      create: {
        shopId,
        createdByUserId: userId,
        status: 'CONNECTING',
        connectTicket: ticket,
        ticketExpiresAt,
        lastError: null,
        disconnectedAt: null,
      },
      update: {
        createdByUserId: userId,
        status: 'CONNECTING',
        connectTicket: ticket,
        ticketExpiresAt,
        lastError: null,
        disconnectedAt: null,
      },
    });
    return {
      configured: true,
      ticket,
      appId,
      configId,
      graphVersion,
      signupUrl: publicBase
        ? `${publicBase}/integrations/whatsapp/signup/${ticket}`
        : null,
    };
  }

  async signupHtml(ticket: string) {
    if (!metaReady()) {
      throw new ServiceUnavailableException('WhatsApp is not configured on this server.');
    }
    const row = await this.prisma.whatsappIntegration.findFirst({
      where: { connectTicket: ticket },
    });
    if (!row || !row.ticketExpiresAt || row.ticketExpiresAt.getTime() < Date.now()) {
      throw new NotFoundException('Connect session expired. Start again from the app.');
    }
    const { appId, configId, graphVersion } = metaConfig();
    return embeddedSignupHtml({ appId, configId, graphVersion });
  }

  async complete(
    shopId: number,
    dto: { ticket: string; code: string; wabaId?: string; phoneNumberId?: string },
  ) {
    if (!metaReady()) {
      throw new ServiceUnavailableException('WhatsApp is not configured on this server.');
    }
    const row = await this.prisma.whatsappIntegration.findUnique({ where: { shopId } });
    if (!row || row.connectTicket !== dto.ticket) {
      throw new BadRequestException('WhatsApp connect session expired. Start again.');
    }
    if (!row.ticketExpiresAt || row.ticketExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('WhatsApp connect session expired. Start again.');
    }

    try {
      const { accessToken, expiresAt } = await exchangeCode(dto.code);
      let wabaId = dto.wabaId;
      let phoneNumberId = dto.phoneNumberId;
      let displayPhoneNumber: string | undefined;
      let verifiedName: string | undefined;
      let metaBusinessId: string | undefined;

      if (wabaId && phoneNumberId) {
        const [phone, waba] = await Promise.all([
          fetchPhone(accessToken, phoneNumberId),
          fetchWaba(accessToken, wabaId),
        ]);
        displayPhoneNumber = phone.display_phone_number;
        verifiedName = phone.verified_name ?? waba.name;
        metaBusinessId = waba.owner_business_info?.id;
      } else {
        const found = await discoverAssets(accessToken);
        wabaId = found.wabaId;
        phoneNumberId = found.phoneNumberId;
        displayPhoneNumber = found.displayPhoneNumber;
        verifiedName = found.verifiedName;
        metaBusinessId = found.metaBusinessId;
      }

      if (!wabaId || !phoneNumberId) {
        throw new BadRequestException(
          'Could not find a WhatsApp Business phone after signup. Finish asset selection in Meta and try again.',
        );
      }

      await subscribeWaba(accessToken, wabaId);

      await this.prisma.whatsappIntegration.update({
        where: { shopId },
        data: {
          status: 'CONNECTED',
          wabaId,
          phoneNumberId,
          displayPhoneNumber: displayPhoneNumber ?? null,
          verifiedName: verifiedName ?? null,
          metaBusinessId: metaBusinessId ?? null,
          accessTokenEnc: encryptSecret(accessToken),
          tokenExpiresAt: expiresAt,
          connectTicket: null,
          ticketExpiresAt: null,
          lastError: null,
          disconnectedAt: null,
        },
      });
      return this.publicOf(shopId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'WhatsApp connect failed.';
      this.log.warn(`connect failed shop=${shopId}: ${msg}`);
      await this.prisma.whatsappIntegration.update({
        where: { shopId },
        data: { status: 'ERROR', lastError: msg, connectTicket: null, ticketExpiresAt: null },
      });
      if (e instanceof BadRequestException || e instanceof ServiceUnavailableException) throw e;
      throw new BadRequestException(msg);
    }
  }

  async disconnect(shopId: number) {
    const row = await this.prisma.whatsappIntegration.findUnique({ where: { shopId } });
    if (!row) return this.emptyPublic();
    await this.prisma.whatsappIntegration.update({
      where: { shopId },
      data: {
        status: 'DISCONNECTED',
        accessTokenEnc: null,
        tokenExpiresAt: null,
        connectTicket: null,
        ticketExpiresAt: null,
        lastError: null,
        disconnectedAt: new Date(),
      },
    });
    return this.publicOf(shopId);
  }

  async test(shopId: number, phone: string) {
    const to = toE164(phone);
    if (!to) throw new BadRequestException('Enter a valid phone number.');
    const { testTemplate } = metaConfig();
    return this.send(shopId, {
      to,
      kind: testTemplate ? 'template' : 'text',
      template: testTemplate
        ? { name: testTemplate, language: 'en', parameters: ['NestPro'] }
        : undefined,
      text: testTemplate
        ? undefined
        : 'Test from NestPro. If this fails, Meta needs an approved template or a 24-hour customer window.',
      messageType: 'test',
    });
  }

  async notifyGreeting(
    shopId: number,
    input: { phone: string; customerName: string; shopName: string },
  ) {
    const to = toE164(input.phone);
    if (!to) return { sent: false, reason: 'Invalid phone number' };
    const conn = await this.liveConnection(shopId);
    if (!conn) return { sent: false, reason: 'WhatsApp not connected' };
    const { greetingTemplate, testTemplate, templateLang } = metaConfig();
    const name = greetingTemplate || testTemplate;
    try {
      if (name) {
        await this.send(shopId, {
          to,
          kind: 'template',
          template: {
            name,
            language: templateLang,
            parameters: [input.customerName, input.shopName],
          },
          messageType: 'client_welcome',
        });
      } else {
        await this.send(shopId, {
          to,
          kind: 'text',
          text: `Hi ${input.customerName}, welcome to ${input.shopName}. Reply here to book.`,
          messageType: 'client_welcome',
        });
      }
      return { sent: true as const, reason: null };
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'WhatsApp send failed';
      this.log.warn(`greeting shop=${shopId}: ${reason}`);
      return { sent: false, reason };
    }
  }

  async notifyAppointment(
    shopId: number,
    input: {
      kind: NotifyKind;
      phone: string;
      customerName: string;
      serviceName: string;
      when: string;
      shopName: string;
    },
  ) {
    const to = toE164(input.phone);
    if (!to) return;
    const conn = await this.liveConnection(shopId);
    if (!conn) return;
    const { testTemplate } = metaConfig();
    const body = this.notifyText(input);
    try {
      await this.send(shopId, {
        to,
        kind: testTemplate ? 'template' : 'text',
        template: testTemplate
          ? {
              name: testTemplate,
              language: 'en',
              parameters: [input.customerName, input.when, input.shopName],
            }
          : undefined,
        text: body,
        messageType: input.kind,
      });
    } catch (e) {
      this.log.warn(`notify ${input.kind} shop=${shopId}: ${e instanceof Error ? e.message : 'fail'}`);
    }
  }

  async send(
    shopId: number,
    msg: {
      to: string;
      kind: 'text' | 'template';
      text?: string;
      template?: { name: string; language: string; parameters: string[] };
      messageType: string;
    },
  ) {
    const conn = await this.liveConnection(shopId);
    if (!conn) {
      throw new BadRequestException('WhatsApp is not connected for this shop.');
    }
    try {
      await sendWhatsApp({
        phoneNumberId: conn.phoneNumberId,
        token: conn.token,
        to: msg.to,
        type: msg.kind,
        text: msg.text,
        template: msg.template,
      });
      return { ok: true, status: 'SENT' as const };
    } catch (e) {
      const err = e instanceof MetaApiError ? e : new MetaApiError('Unable to send WhatsApp message.');
      if (err.code === 190) {
        await this.prisma.whatsappIntegration.update({
          where: { shopId },
          data: { status: 'EXPIRED', lastError: err.message },
        });
      }
      throw new BadRequestException(err.message);
    }
  }

  verifyChallenge(mode?: string, token?: string, challenge?: string) {
    const { verifyToken } = metaConfig();
    if (mode === 'subscribe' && token && verifyToken && token === verifyToken && challenge) {
      return challenge;
    }
    return null;
  }

  verifySignature(raw: Buffer, header?: string) {
    const { appSecret } = metaConfig();
    if (!appSecret) return false;
    return verifyMetaSignature(raw, header, appSecret);
  }

  async handleWebhook(_body: any) {
    return { ok: true };
  }

  private async liveConnection(shopId: number) {
    const row = await this.prisma.whatsappIntegration.findUnique({ where: { shopId } });
    if (!row || row.status !== 'CONNECTED' || !row.accessTokenEnc || !row.phoneNumberId) {
      return null;
    }
    if (row.tokenExpiresAt && row.tokenExpiresAt.getTime() < Date.now()) {
      await this.prisma.whatsappIntegration.update({
        where: { shopId },
        data: { status: 'EXPIRED', lastError: 'Access token expired' },
      });
      return null;
    }
    return {
      id: row.id,
      phoneNumberId: row.phoneNumberId,
      token: decryptSecret(row.accessTokenEnc),
    };
  }

  private async publicOf(shopId: number) {
    const configured = metaReady();
    const row = await this.prisma.whatsappIntegration.findUnique({ where: { shopId } });
    if (!row) return { ...this.emptyPublic(), configured };
    return {
      configured,
      setupHint: configured
        ? null
        : 'Set META_APP_ID, META_APP_SECRET, META_CONFIG_ID on the server. See Nest/WHATSAPP.md.',
      status: row.status,
      verifiedName: row.verifiedName,
      displayPhoneNumber: row.displayPhoneNumber,
      lastError: row.lastError,
    };
  }

  private emptyPublic() {
    const configured = metaReady();
    return {
      configured,
      setupHint: configured
        ? null
        : 'Set META_APP_ID, META_APP_SECRET, META_CONFIG_ID on the server. See Nest/WHATSAPP.md.',
      status: 'DISCONNECTED' as const,
      verifiedName: null,
      displayPhoneNumber: null,
      lastError: null,
    };
  }

  private notifyText(input: {
    kind: NotifyKind;
    customerName: string;
    serviceName: string;
    when: string;
    shopName: string;
  }) {
    if (input.kind === 'appointment_cancellation') {
      return `${input.shopName}: ${input.serviceName} on ${input.when} was cancelled.`;
    }
    if (input.kind === 'appointment_reschedule') {
      return `${input.shopName}: ${input.serviceName} moved to ${input.when}.`;
    }
    if (input.kind === 'appointment_reminder') {
      return `${input.shopName}: reminder — ${input.serviceName} on ${input.when}. See you, ${input.customerName}.`;
    }
    return `${input.shopName}: ${input.serviceName} booked for ${input.when}. See you, ${input.customerName}.`;
  }
}
