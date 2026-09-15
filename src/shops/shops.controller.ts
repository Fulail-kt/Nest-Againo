import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload';
import { requireShopId } from '../common/require-shop';
import { Roles, ShopAdmin } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { ShopAdminGuard } from '../common/shop-admin.guard';
import { CreateAppointmentDto, PatchAppointmentDto } from './dto/appointment.dto';
import { MoveChairDto, UpdateShopDto, UpsertChairDto, UpsertCustomerDto, UpsertServiceDto } from './dto/shop.dto';
import { ShopsService } from './shops.service';

@ApiTags('shops')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard, ShopAdminGuard)
@Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
@Controller('shops')
export class ShopsController {
  constructor(private readonly shops: ShopsService) {}

  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.shops.me(requireShopId(user), user);
  }

  @Patch('me')
  @ShopAdmin()
  update(@CurrentUser() user: JwtPayload, @Body() dto: UpdateShopDto) {
    return this.shops.update(requireShopId(user), dto, user);
  }

  @Get('customers')
  customers(@CurrentUser() user: JwtPayload, @Query('q') q?: string) {
    return this.shops.listCustomers(requireShopId(user), q);
  }

  @Post('customers')
  addCustomer(@CurrentUser() user: JwtPayload, @Body() dto: UpsertCustomerDto) {
    return this.shops.createCustomer(requireShopId(user), dto);
  }

  @Get('customers/:id')
  customer(@CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    return this.shops.getCustomer(requireShopId(user), id);
  }

  @Patch('customers/:id')
  editCustomer(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertCustomerDto,
  ) {
    return this.shops.updateCustomer(requireShopId(user), id, dto);
  }

  @Delete('customers/:id')
  dropCustomer(@CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    return this.shops.removeCustomer(requireShopId(user), id);
  }

  @Post('customers/:id/photos')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }))
  addPhoto(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file?: { mimetype?: string; size?: number; buffer?: Buffer },
  ) {
    return this.shops.addCustomerPhoto(requireShopId(user), id, file);
  }

  @Delete('customers/:id/photos')
  dropPhoto(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Query('file') file: string,
  ) {
    return this.shops.removeCustomerPhoto(requireShopId(user), id, file);
  }

  @Get('chairs')
  chairs(@CurrentUser() user: JwtPayload) {
    return this.shops.listChairs(requireShopId(user));
  }

  @Post('chairs')
  @ShopAdmin()
  addChair(@CurrentUser() user: JwtPayload, @Body() dto: UpsertChairDto) {
    return this.shops.createChair(requireShopId(user), dto);
  }

  @Patch('chairs/:id')
  editChair(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertChairDto,
  ) {
    return this.shops.updateChair(requireShopId(user), id, dto, user);
  }

  @Post('chairs/:id/move')
  @ShopAdmin()
  moveChair(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MoveChairDto,
  ) {
    return this.shops.moveChairBookings(requireShopId(user), id, dto.to);
  }

  @Delete('chairs/:id')
  @ShopAdmin()
  dropChair(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Query('to') to?: string,
  ) {
    const moveTo = to ? Number(to) : undefined;
    if (to && (!Number.isInteger(moveTo) || (moveTo as number) < 1)) {
      throw new BadRequestException('Pick another chair to take the bookings.');
    }
    return this.shops.removeChair(requireShopId(user), id, moveTo, user);
  }

  @Get('services')
  services(@CurrentUser() user: JwtPayload) {
    return this.shops.listServices(requireShopId(user));
  }

  @Post('services')
  @ShopAdmin()
  addService(@CurrentUser() user: JwtPayload, @Body() dto: UpsertServiceDto) {
    return this.shops.createService(requireShopId(user), dto);
  }

  @Patch('services/:id')
  @ShopAdmin()
  editService(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertServiceDto,
  ) {
    return this.shops.updateService(requireShopId(user), id, dto);
  }

  @Delete('services/:id')
  @ShopAdmin()
  dropService(@CurrentUser() user: JwtPayload, @Param('id', ParseIntPipe) id: number) {
    return this.shops.removeService(requireShopId(user), id);
  }

  @Get('appointments')
  appointments(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('older') older?: string,
  ) {
    return this.shops.listAppointments(requireShopId(user), from, to, user, older === '1' || older === 'true');
  }

  @Post('appointments')
  addAppointment(@CurrentUser() user: JwtPayload, @Body() dto: CreateAppointmentDto) {
    return this.shops.createAppointment(requireShopId(user), dto, user);
  }

  @Patch('appointments/:id')
  editAppointment(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PatchAppointmentDto,
  ) {
    return this.shops.patchAppointment(requireShopId(user), id, dto, user);
  }
}
