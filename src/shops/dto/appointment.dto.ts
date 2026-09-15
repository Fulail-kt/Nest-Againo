import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty()
  @IsInt()
  customerId!: number;

  @ApiProperty()
  @IsInt()
  serviceId!: number;

  @ApiProperty({ example: '2026-09-12T10:00:00.000Z' })
  @IsDateString()
  startAt!: string;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(240)
  durationMinutes?: number;

  @ApiPropertyOptional({ description: 'Omit to pick preferred chair, then first free' })
  @IsOptional()
  @IsInt()
  chairId?: number;
}

export class PatchAppointmentDto {
  @ApiPropertyOptional({ enum: ['BOOKED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] })
  @IsOptional()
  @IsIn(['BOOKED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
  status?: 'BOOKED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  customerId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  serviceId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(240)
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  chairId?: number;
}
