import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty()
  @IsString()
  @MinLength(20, { message: 'Google sign-in didn’t finish. Try again.' })
  idToken!: string;
}
