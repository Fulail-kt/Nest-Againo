import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProgrammeMode } from '../../../generated/prisma/client';

export class ProgrammeItemDto {
  @ApiProperty()
  @IsInt()
  exerciseId!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  order!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(50)
  sets!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  reps?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600)
  restSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  durationSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ProgrammeDayDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  order!: number;

  @ApiProperty({ type: [ProgrammeItemDto] })
  @ValidateNested({ each: true })
  @Type(() => ProgrammeItemDto)
  @ArrayMinSize(1)
  exercises!: ProgrammeItemDto[];
}

export class CreateProgrammeDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ProgrammeMode, default: ProgrammeMode.REPEAT })
  @IsOptional()
  @IsEnum(ProgrammeMode)
  mode?: ProgrammeMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  nextProgrammeId?: number;

  @ApiProperty({ type: [ProgrammeDayDto] })
  @ValidateNested({ each: true })
  @Type(() => ProgrammeDayDto)
  @ArrayMinSize(1)
  days!: ProgrammeDayDto[];
}

export class PatchProgrammeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ProgrammeMode })
  @IsOptional()
  @IsEnum(ProgrammeMode)
  mode?: ProgrammeMode;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  nextProgrammeId?: number | null;
}

export class AddDayDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;
}

export class ReorderDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  ids!: number[];
}

export class AddDayExerciseDto extends ProgrammeItemDto {}

export class PatchExerciseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  sets?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  reps?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(600)
  restSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
