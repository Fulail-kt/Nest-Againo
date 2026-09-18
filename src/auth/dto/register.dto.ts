import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'owner@shop.com' })
  @IsEmail({}, { message: 'Enter a valid email' })
  @MaxLength(120, { message: 'Enter a valid email' })
  email!: string;

  @ApiProperty({ example: 'Alex Owner' })
  @IsString()
  @MinLength(2, { message: 'Enter your full name' })
  @MaxLength(80, { message: 'Enter your full name' })
  name!: string;

  @ApiProperty({ example: 'secret123' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @MaxLength(72, { message: 'Password must be at least 6 characters' })
  password!: string;
}
