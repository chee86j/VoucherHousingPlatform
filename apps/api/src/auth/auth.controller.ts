import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto, MfaVerifyDto, MfaBootstrapDto, MfaBootstrapConfirmDto } from './dto/auth.dto';

type Profile = { id: string; email: string; name: string; role: string; orgId: string; mfaEnrolled: boolean };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto.email, dto.password, { ip: request.ip, userAgent: request.headers['user-agent'] });
  }

  @Public()
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  verifyMfa(@Body() dto: MfaVerifyDto, @Req() request: Request) {
    return this.authService.verifyMfa(dto.mfaToken, dto.totpCode, { ip: request.ip, userAgent: request.headers['user-agent'] });
  }

  @Public()
  @Post('mfa/bootstrap')
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  bootstrap(@Body() dto: MfaBootstrapDto) {
    return this.authService.enrollWithChallenge(dto.mfaToken);
  }

  @Public()
  @Post('mfa/bootstrap/confirm')
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  bootstrapConfirm(@Body() dto: MfaBootstrapConfirmDto, @Req() request: Request) {
    return this.authService.confirmWithChallenge(dto.mfaToken, dto.totpCode, { ip: request.ip, userAgent: request.headers['user-agent'] });
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: Profile) {
    return { id: user.id, email: user.email, name: user.name, role: user.role, orgId: user.orgId, mfaEnrolled: user.mfaEnrolled };
  }
}
