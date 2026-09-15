import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CompleteWhatsappDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  ticket!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  wabaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneNumberId?: string;
}

export class TestWhatsappDto {
  @ApiProperty({ example: '9876543210' })
  @Transform(({ value }) => String(value ?? '').replace(/\D/g, ''))
  @Matches(/^\d{10,15}$/, { message: '10–15 digit phone' })
  phone!: string;
}
