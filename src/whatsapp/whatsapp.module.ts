import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppSignupController } from './whatsapp.signup.controller';
import { WhatsAppWebhookController } from './whatsapp.webhook.controller';

@Module({
  imports: [AuthModule],
  controllers: [WhatsAppController, WhatsAppSignupController, WhatsAppWebhookController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
