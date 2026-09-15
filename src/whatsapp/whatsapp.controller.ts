import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload';
import { requireShopId } from '../common/require-shop';
import { Roles, ShopAdmin } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { ShopAdminGuard } from '../common/shop-admin.guard';
import { CompleteWhatsappDto, TestWhatsappDto } from './dto/whatsapp.dto';
import { WhatsAppService } from './whatsapp.service';

@ApiTags('whatsapp')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard, ShopAdminGuard)
@Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
@ShopAdmin()
@Controller('integrations/whatsapp')
export class WhatsAppController {
  constructor(private readonly wa: WhatsAppService) {}

  @Get()
  status(@CurrentUser() user: JwtPayload) {
    return this.wa.status(requireShopId(user));
  }

  @Post('connect')
  connect(@CurrentUser() user: JwtPayload) {
    return this.wa.connect(requireShopId(user), user.sub);
  }

  @Post('complete')
  complete(@CurrentUser() user: JwtPayload, @Body() dto: CompleteWhatsappDto) {
    return this.wa.complete(requireShopId(user), dto);
  }

  @Post('disconnect')
  disconnect(@CurrentUser() user: JwtPayload) {
    return this.wa.disconnect(requireShopId(user));
  }

  @Post('test')
  test(@CurrentUser() user: JwtPayload, @Body() dto: TestWhatsappDto) {
    return this.wa.test(requireShopId(user), dto.phone);
  }
}
