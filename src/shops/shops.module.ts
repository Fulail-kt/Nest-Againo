import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { ReminderService } from './reminder.service';
import { ShopsController } from './shops.controller';
import { ShopsService } from './shops.service';

@Module({
  imports: [AuthModule, WhatsAppModule],
  controllers: [ShopsController],
  providers: [ShopsService, ReminderService],
})
export class ShopsModule {}
