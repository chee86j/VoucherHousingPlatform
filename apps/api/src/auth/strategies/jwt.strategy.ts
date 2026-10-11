/**
 * JWT Strategy - Passport authentication
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { jwtSecret } from '../jwt-secret';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  orgId: string;
  mfaVerified: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret(configService),
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload || typeof payload.sub !== 'string' || !payload.sub || payload.mfaVerified !== true ||
        (payload as JwtPayload & { purpose?: string; mfaPending?: boolean }).purpose ||
        (payload as JwtPayload & { mfaPending?: boolean }).mfaPending) {
      throw new UnauthorizedException('Full authentication required');
    }
    const user = await this.authService.validateToken({ sub: payload.sub });
    
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status !== 'ACTIVE' || (user.lockedUntil && user.lockedUntil > new Date())) {
      throw new UnauthorizedException('Account is not active');
    }
    if (this.authService.requiresStaffMfa(user) && (!user.mfaEnrolled || !user.mfaSecret)) {
      throw new UnauthorizedException('MFA enrollment required');
    }

    // Return user data for request.user
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.orgId,
      mfaVerified: true,
      mfaEnrolled: user.mfaEnrolled,
    };
  }
}
