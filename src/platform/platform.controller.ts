import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '../../generated/prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { OwnerDetailDto, OwnerListItemDto } from './platform.dto';
import { PlatformService } from './platform.service';

@ApiTags('platform')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('platform')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('owners')
  @ApiOkResponse({ type: [OwnerListItemDto] })
  listOwners() {
    return this.platform.listOwners();
  }

  @Get('owners/:id')
  @ApiOkResponse({ type: OwnerDetailDto })
  getOwner(@Param('id', ParseIntPipe) id: number) {
    return this.platform.getOwner(id);
  }
}
