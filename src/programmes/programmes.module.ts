import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProgrammesController } from './programmes.controller';
import { ProgrammesService } from './programmes.service';

@Module({
  imports: [AuthModule],
  controllers: [ProgrammesController],
  providers: [ProgrammesService],
})
export class ProgrammesModule {}
