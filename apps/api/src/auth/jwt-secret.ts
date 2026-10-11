import { ConfigService } from '@nestjs/config';

export function jwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  if (!secret || secret.trim().length < 32 || secret === 'dev-secret-change-in-production') {
    throw new Error('JWT_SECRET must be explicitly set to a random secret of at least 32 characters');
  }
  return secret;
}