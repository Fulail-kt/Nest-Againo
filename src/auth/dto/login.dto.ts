import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'john@mail.com', description: 'Email or staff phone' })
  @IsString()
  @MinLength(6, { message: 'Enter your email or phone' })
  @MaxLength(120, { message: 'Enter your email or phone' })
  email!: string;

  @ApiProperty({ example: 'secret123' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @MaxLength(72, { message: 'Password must be at least 6 characters' })
  password!: string;
}
