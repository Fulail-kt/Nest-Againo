import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class StartWorkoutDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  dayId!: number;
}

export class LogSetDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  programmeExerciseId!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  setNumber!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(2000)
  weightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  reps?: number;
}

export class LogExtraDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  exerciseId!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  setNumber!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(2000)
  weightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  reps?: number;
}

export class ClearSetsDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  programmeExerciseId!: number;
}
