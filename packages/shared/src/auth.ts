/**
 * Auth-related types and interfaces
 */

import { UserRole, UserStatus } from './index.js';

/**
 * JWT payload structure
 */
export interface JwtPayload {
  sub: string;        // User ID
  email: string;
  role: UserRole;
  orgId: string;
  mfaVerified: boolean;
  iat: number;
  exp: number;
}

/**
 * Session data stored in Redis
 */
export interface SessionData {
  userId: string;
  email: string;
  role: UserRole;
  orgId: string;
  mfaVerified: boolean;
  createdAt: number;
  lastActivityAt: number;
  ipAddress: string;
  userAgent: string;
}

/**
 * Login request
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Login response
 */
export interface LoginResponse {
  requiresMfa: boolean;
  mfaToken?: string;  // Temporary token for MFA verification step
  accessToken?: string;
  user?: UserProfile;
}

/**
 * MFA verification request
 */
export interface MfaVerifyRequest {
  mfaToken: string;
  totpCode: string;
}

/**
 * User profile (safe to expose)
 */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  orgId: string;
  mfaEnrolled: boolean;
  lastLoginAt: Date | null;
}

/**
 * Register request (admin-created users)
 */
export interface CreateUserRequest {
  email: string;
  name: string;
  role: UserRole;
  password?: string;  // If not provided, send magic link
}

/**
 * Password requirements
 */
export const PASSWORD_REQUIREMENTS = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
} as const;

/**
 * Session configuration
 */
export const SESSION_CONFIG = {
  idleTimeoutMs: 30 * 60 * 1000,      // 30 minutes for staff
  absoluteTimeoutMs: 12 * 60 * 60 * 1000, // 12 hours
  tenantIdleTimeoutMs: 60 * 60 * 1000,    // 1 hour for tenants
} as const;

/**
 * MFA configuration
 */
export const MFA_CONFIG = {
  issuer: 'VoucherHousingPlatform',
  algorithm: 'SHA1' as const,
  digits: 6,
  period: 30,
} as const;
