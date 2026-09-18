import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class OnboardingDto {
  @ApiProperty({ example: 'Iron Peak Gym' })
  @IsString()
  @MinLength(2, { message: 'Enter a company name' })
  @MaxLength(80, { message: 'Company name is too long' })
  companyName!: string;

  @ApiProperty({ enum: ['GYM', 'BARBER'] })
  @IsIn(['GYM', 'BARBER'], { message: 'Pick a company type' })
  kind!: 'GYM' | 'BARBER';
}
