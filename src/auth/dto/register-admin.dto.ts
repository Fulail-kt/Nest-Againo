import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterAdminDto {
  @ApiProperty({ example: 'owner@gym.com' })
  @IsEmail()
  @MaxLength(120)
  email!: string;

  @ApiProperty({ example: 'Alex Admin' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'secret123' })
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password!: string;

  @ApiPropertyOptional({ enum: ['GYM', 'BARBER'], example: 'GYM' })
  @IsOptional()
  @IsIn(['GYM', 'BARBER'])
  kind?: 'GYM' | 'BARBER';

  @ApiPropertyOptional({ example: 'Iron Peak Gym' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  businessName?: string;

  /** @deprecated old clients sent gymName */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gymName?: string;
}
