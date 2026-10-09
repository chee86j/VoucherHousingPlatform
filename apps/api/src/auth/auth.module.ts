/**
 * Auth Module
 * 
 * From docs/ARCHITECTURE_DISCOVERY.md §7:
 * - Email/password + mandatory TOTP MFA for staff
 * - Server-side sessions in Redis
 * - JWT for API authentication
 */

import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AuditService } from './audit.service';

@Global()
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'dev-secret-change-in-production',
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN') || '15m',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuditService,
    JwtStrategy,
    AuthGuard,
    RolesGuard,
  ],
  exports: [AuthService, AuditService, AuthGuard, RolesGuard],
})
export class AuthModule {}
