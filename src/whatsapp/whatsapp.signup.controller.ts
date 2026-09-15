import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { WhatsAppService } from './whatsapp.service';

@ApiExcludeController()
@Controller('integrations/whatsapp')
export class WhatsAppSignupController {
  constructor(private readonly wa: WhatsAppService) {}

  @Get('signup/:ticket')
  async page(@Param('ticket') ticket: string, @Res() res: Response) {
    const html = await this.wa.signupHtml(ticket);
    res.type('html').send(html);
  }
}
