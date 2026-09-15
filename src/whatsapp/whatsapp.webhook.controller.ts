import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { WhatsAppService } from './whatsapp.service';

@ApiExcludeController()
@Controller('webhooks/meta/whatsapp')
export class WhatsAppWebhookController {
  constructor(private readonly wa: WhatsAppService) {}

  @Get()
  @Header('Content-Type', 'text/plain')
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ) {
    const ok = this.wa.verifyChallenge(mode, token, challenge);
    if (!ok) throw new ForbiddenException('Webhook verification failed');
    return ok;
  }

  @Post()
  ingest(@Req() req: RawBodyRequest<Request>) {
    const raw = req.rawBody;
    const sig = req.headers['x-hub-signature-256'];
    const header = Array.isArray(sig) ? sig[0] : sig;
    if (!raw || !this.wa.verifySignature(raw, header)) {
      throw new ForbiddenException('Invalid webhook signature');
    }
    return this.wa.handleWebhook(req.body);
  }
}
