import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { MembershipStatus, ProgrammeMode } from '../../../generated/prisma/client';

export class CreateMemberDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(120)
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'secret123' })
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password!: string;
}

export class UpdateMemberDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ enum: MembershipStatus })
  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;
}

export class MemberQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;
}

export class AssignProgrammeDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  programmeId!: number;

  /** Omit to follow the programme’s own Once / Repeat setting. */
  @ApiPropertyOptional({ enum: ProgrammeMode })
  @IsOptional()
  @IsEnum(ProgrammeMode)
  mode?: ProgrammeMode;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  nextProgrammeId?: number;
}
