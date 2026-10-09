/**
 * Auth Service - Authentication and session management
 * 
 * Security features from docs/ARCHITECTURE_DISCOVERY.md §7:
 * - Argon2id password hashing
 * - TOTP MFA for staff
 * - Rate limiting on login attempts
 * - Account lockout after failed attempts
 */

import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import { prisma, User, UserRole, UserStatus } from '@vhp/database';
import { AuditService } from './audit.service';

interface LoginResult {
  requiresMfa: boolean;
  mfaToken?: string;
  accessToken?: string;
  user?: UserProfile;
}

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  orgId: string;
  mfaEnrolled: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MINUTES = 15;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Authenticate user with email and password
   */
  async login(
    email: string,
    password: string,
    metadata: { ip?: string; userAgent?: string },
  ): Promise<LoginResult> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      await this.auditService.logAuth('LOGIN_FAILED', null, {
        email,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check account status
    if (user.status !== UserStatus.ACTIVE) {
      await this.auditService.logAuth('LOGIN_FAILED', user.id, {
        email,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        orgId: user.orgId,
      });
      throw new UnauthorizedException('Account is not active');
    }

    // Check lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new UnauthorizedException(
        `Account locked. Try again in ${remainingMinutes} minutes`,
      );
    }

    // Verify password
    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const validPassword = await argon2.verify(user.passwordHash, password);
    if (!validPassword) {
      await this.handleFailedLogin(user, metadata);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on successful password
    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null },
    });

    // Check if MFA is required
    if (user.mfaEnrolled && user.mfaSecret) {
      // Return a temporary MFA token
      const mfaToken = this.jwtService.sign(
        { sub: user.id, mfaPending: true },
        { expiresIn: '5m' },
      );

      return { requiresMfa: true, mfaToken };
    }

    // Staff without MFA should be warned (but allowed in dev)
    if (this.staffRoles.includes(user.role) && !user.mfaEnrolled) {
      this.logger.warn(`Staff user ${user.email} logged in without MFA`);
    }

    // Issue access token
    return this.issueToken(user, metadata);
  }

  /**
   * Verify MFA code and complete login
   */
  async verifyMfa(
    mfaToken: string,
    totpCode: string,
    metadata: { ip?: string; userAgent?: string },
  ): Promise<LoginResult> {
    // Verify MFA token
    let payload: { sub: string; mfaPending: boolean };
    try {
      payload = this.jwtService.verify(mfaToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired MFA token');
    }

    if (!payload.mfaPending) {
      throw new BadRequestException('Invalid MFA token');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.mfaSecret) {
      throw new UnauthorizedException('Invalid MFA configuration');
    }

    // Verify TOTP code
    const valid = authenticator.verify({
      token: totpCode,
      secret: user.mfaSecret,
    });

    if (!valid) {
      await this.auditService.logAuth('LOGIN_FAILED', user.id, {
        email: user.email,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        orgId: user.orgId,
      });
      throw new UnauthorizedException('Invalid MFA code');
    }

    await this.auditService.logAuth('MFA_VERIFIED', user.id, {
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      orgId: user.orgId,
    });

    return this.issueToken(user, metadata);
  }

  /**
   * Generate MFA secret for enrollment
   */
  async generateMfaSecret(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(
      user.email,
      'VoucherHousingPlatform',
      secret,
    );

    // Store temporarily - will be confirmed on first use
    await prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret },
    });

    return { secret, otpauthUrl };
  }

  /**
   * Confirm MFA enrollment
   */
  async confirmMfaEnrollment(
    userId: string,
    totpCode: string,
    metadata: { ip?: string },
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.mfaSecret) {
      throw new BadRequestException('MFA not configured');
    }

    const valid = authenticator.verify({
      token: totpCode,
      secret: user.mfaSecret,
    });

    if (!valid) {
      throw new BadRequestException('Invalid MFA code');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { mfaEnrolled: true },
    });

    await this.auditService.logAuth('MFA_ENROLLED', userId, {
      ip: metadata.ip,
      orgId: user.orgId,
    });
  }

  /**
   * Hash a password with Argon2id
   */
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,  // 64 MB
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Validate JWT token and return user
   */
  async validateToken(payload: { sub: string }): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id: payload.sub },
    });
  }

  private async handleFailedLogin(
    user: User,
    metadata: { ip?: string; userAgent?: string },
  ): Promise<void> {
    const failedAttempts = user.failedAttempts + 1;
    
    const updateData: { failedAttempts: number; lockedUntil?: Date } = {
      failedAttempts,
    };

    if (failedAttempts >= this.MAX_LOGIN_ATTEMPTS) {
      updateData.lockedUntil = new Date(
        Date.now() + this.LOCKOUT_DURATION_MINUTES * 60 * 1000,
      );
      this.logger.warn(`Account locked: ${user.email} after ${failedAttempts} failed attempts`);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    await this.auditService.logAuth('LOGIN_FAILED', user.id, {
      email: user.email,
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      orgId: user.orgId,
    });
  }

  private async issueToken(
    user: User,
    metadata: { ip?: string; userAgent?: string },
  ): Promise<LoginResult> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      orgId: user.orgId,
      mfaVerified: user.mfaEnrolled,
    };

    const accessToken = this.jwtService.sign(payload);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: metadata.ip,
      },
    });

    await this.auditService.logAuth('LOGIN', user.id, {
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      orgId: user.orgId,
    });

    return {
      requiresMfa: false,
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        orgId: user.orgId,
        mfaEnrolled: user.mfaEnrolled,
      },
    };
  }

  private readonly staffRoles: UserRole[] = [
    UserRole.ADMIN,
    UserRole.BROKER,
    UserRole.ASSISTANT,
    UserRole.AUDITOR,
  ];
}
