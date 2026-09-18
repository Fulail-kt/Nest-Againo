import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { AuthResponseDto, UserPublicDto } from './dto/auth-response.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { OnboardingDto } from './dto/onboarding.dto';
import { RegisterAdminDto } from './dto/register-admin.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { JwtPayload } from './jwt-payload';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Owner account — name, email, password. Company setup is onboarding.' })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiConflictResponse({ description: 'That email already has an account. Sign in instead.' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('register-admin')
  @ApiOperation({ summary: 'Legacy: create owner + company in one step' })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiConflictResponse({ description: 'That email already has an account. Sign in instead.' })
  registerAdmin(@Body() dto: RegisterAdminDto) {
    return this.authService.registerAdmin(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login for owner, staff, or member' })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse()
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('google')
  @ApiOperation({ summary: 'Owner sign-in with Google ID token' })
  @ApiOkResponse({ type: AuthResponseDto })
  google(@Body() dto: GoogleAuthDto) {
    return this.authService.google(dto);
  }

  @Post('verify-email')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ type: AuthResponseDto })
  verifyEmail(@CurrentUser() user: JwtPayload, @Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(user, dto.code);
  }

  @Post('resend-verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  resendVerify(@CurrentUser() user: JwtPayload) {
    return this.authService.resendVerify(user);
  }

  @Post('onboarding')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ type: AuthResponseDto })
  onboard(@CurrentUser() user: JwtPayload, @Body() dto: OnboardingDto) {
    return this.authService.onboard(user, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Current user profile' })
  @ApiOkResponse({ type: UserPublicDto })
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user);
  }
}
