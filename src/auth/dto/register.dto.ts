import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @ApiProperty({ example: 'member@gym.com' })
  @IsEmail()
  @MaxLength(120)
  email!: string;

  @ApiProperty({ example: 'Jane Member' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'secret123' })
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ example: 'ABC123', description: 'Gym join code' })
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase())
  @Matches(/^[A-Z0-9]{4,8}$/, { message: '4–8 letter or number gym code' })
  gymCode!: string;
}
