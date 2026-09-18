import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { oauthReturnHtml } from './signup.html';
import { WhatsAppService } from './whatsapp.service';

@ApiExcludeController()
@SkipThrottle()
@Controller('integrations/whatsapp')
export class WhatsAppSignupController {
  constructor(private readonly wa: WhatsAppService) {}

  @Get('oauth-return')
  returnPage(@Res() res: Response) {
    res.type('html').send(oauthReturnHtml());
  }

  @Get('signup/:ticket')
  async page(@Param('ticket') ticket: string, @Res() res: Response) {
    const html = await this.wa.signupHtml(ticket);
    res.type('html').send(html);
  }
}
