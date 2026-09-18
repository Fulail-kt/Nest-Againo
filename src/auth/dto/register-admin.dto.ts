import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterAdminDto {
  @ApiProperty({ example: 'owner@gym.com' })
  @IsEmail({}, { message: 'Enter a valid email' })
  @MaxLength(120)
  email!: string;

  @ApiProperty({ example: 'Alex Admin' })
  @IsString()
  @MinLength(2, { message: 'Enter your full name' })
  @MaxLength(80, { message: 'Enter your full name' })
  name!: string;

  @ApiProperty({ example: 'secret123' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @MaxLength(72, { message: 'Password must be at least 6 characters' })
  password!: string;

  @ApiPropertyOptional({ enum: ['GYM', 'BARBER'], example: 'GYM' })
  @IsOptional()
  @IsIn(['GYM', 'BARBER'])
  kind?: 'GYM' | 'BARBER';

  @ApiPropertyOptional({ example: 'Iron Peak Gym' })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Enter a company name' })
  @MaxLength(80, { message: 'Company name is too long' })
  businessName?: string;

  /** @deprecated old clients sent gymName */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gymName?: string;
}
