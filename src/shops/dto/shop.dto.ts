import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

function digitsPhone() {
  return Transform(({ value }) => {
    if (value == null || value === '') return undefined;
    return String(value).replace(/\D/g, '');
  });
}

export class UpdateShopDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @digitsPhone()
  @Matches(/^\d{10,15}$/, { message: '10–15 digit phone' })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ example: 45 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  followUpDays?: number;

  @ApiPropertyOptional({ example: 9 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(22)
  openHour?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(6)
  @Max(23)
  closeHour?: number;

  @ApiPropertyOptional({ example: [0], description: '0=Sun … 6=Sat. Closed every week.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  closedWeekdays?: number[];
}

export class UpsertCustomerDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: '9876543210' })
  @digitsPhone()
  @Matches(/^\d{10,15}$/, { message: '10–15 digit phone' })
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  sendGreeting?: boolean;

  @ApiPropertyOptional({ example: 45 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  followUpDays?: number;

  @ApiPropertyOptional({ nullable: true, description: 'null = any free chair' })
  @IsOptional()
  @IsInt()
  preferredChairId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpsertChairDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  staffName?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @digitsPhone()
  @Matches(/^\d{10,15}$/, { message: '10–15 digit phone' })
  staffPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  staffPassword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canAdmin?: boolean;
}

export class MoveChairDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  to!: number;
}

export class UpsertServiceDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 30 })
  @IsNumber()
  @Min(5)
  @Max(240)
  durationMinutes!: number;

  @ApiProperty({ example: 250 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999)
  price!: number;

  @ApiPropertyOptional({ description: 'Empty = all chairs/staff' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  chairIds?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
