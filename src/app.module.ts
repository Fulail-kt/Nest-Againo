import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AnnouncementsModule } from './announcements/announcements.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AttendanceModule } from './attendance/attendance.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { PlatformModule } from './platform/platform.module';
import { ExercisesModule } from './exercises/exercises.module';
import { GymsModule } from './gyms/gyms.module';
import { MembersModule } from './members/members.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProgrammesModule } from './programmes/programmes.module';
import { ShopsModule } from './shops/shops.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { WorkoutsModule } from './workouts/workouts.module';
import { KeepAliveService } from './keep-alive.service';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 80 }],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    MailModule,
    AuthModule,
    PlatformModule,
    GymsModule,
    MembersModule,
    ExercisesModule,
    ProgrammesModule,
    WorkoutsModule,
    AttendanceModule,
    AnnouncementsModule,
    ShopsModule,
    WhatsAppModule,
  ],
  controllers: [AppController],
  providers: [AppService, KeepAliveService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
