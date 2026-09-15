import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MembershipStatus, Role } from '../../../generated/prisma/client';

export class UserPublicDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'john@mail.com' })
  email!: string;

  @ApiProperty({ example: 'John Doe' })
  name!: string;

  @ApiProperty({ enum: Role })
  role!: Role;

  @ApiProperty({ enum: MembershipStatus })
  status!: MembershipStatus;

  @ApiPropertyOptional({ example: 1, nullable: true })
  gymId!: number | null;

  @ApiPropertyOptional({ example: 1, nullable: true })
  shopId!: number | null;

  @ApiPropertyOptional({ nullable: true })
  phone?: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ type: UserPublicDto })
  user!: UserPublicDto;
}
