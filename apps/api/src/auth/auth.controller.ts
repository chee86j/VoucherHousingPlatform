/**
 * Auth Controller - Login, MFA, and session management endpoints
 */

import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuditAction } from '../common/decorators/audit.decorator';
import { LoginDto, MfaVerifyDto, MfaEnrollDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Login with email and password
   * Returns either an access token or MFA challenge
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @AuditAction('LOGIN')
  async login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto.email, dto.password, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  /**
   * Complete MFA verification
   */
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @AuditAction('MFA_VERIFIED')
  async verifyMfa(@Body() dto: MfaVerifyDto, @Req() request: Request) {
    return this.authService.verifyMfa(dto.mfaToken, dto.totpCode, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  /**
   * Start MFA enrollment (authenticated users only)
   */
  @Post('mfa/enroll')
  @UseGuards(AuthGuard)
  @AuditAction('MFA_ENROLL_START')
  async enrollMfa(@CurrentUser() user: { id: string }) {
    return this.authService.generateMfaSecret(user.id);
  }

  /**
   * Confirm MFA enrollment with TOTP code
   */
  @Post('mfa/confirm')
  @UseGuards(AuthGuard)
  @AuditAction('MFA_ENROLLED')
  async confirmMfa(
    @Body() dto: MfaEnrollDto,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    await this.authService.confirmMfaEnrollment(user.id, dto.totpCode, {
      ip: request.ip,
    });
    return { success: true };
  }

  /**
   * Get current user profile
   */
  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.orgId,
      mfaEnrolled: user.mfaEnrolled,
    };
  }
}
