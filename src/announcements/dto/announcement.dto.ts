import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAnnouncementDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  body!: string;
}
