import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'john@mail.com', description: 'Email or staff phone' })
  @IsString()
  @MinLength(6)
  @MaxLength(120)
  email!: string;

  @ApiProperty({ example: 'secret123' })
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password!: string;
}
