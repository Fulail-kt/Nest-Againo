import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OwnerListItemDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  role!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  emailVerified!: boolean;

  @ApiPropertyOptional({ nullable: true })
  companyName!: string | null;

  @ApiPropertyOptional({ enum: ['GYM', 'BARBER', null], nullable: true })
  companyType!: 'GYM' | 'BARBER' | null;

  @ApiProperty()
  createdAt!: Date;
}

export class OwnerDetailDto extends OwnerListItemDto {
  @ApiPropertyOptional({ nullable: true })
  gymId!: number | null;

  @ApiPropertyOptional({ nullable: true })
  shopId!: number | null;

  @ApiProperty()
  memberOrStaffCount!: number;
}
