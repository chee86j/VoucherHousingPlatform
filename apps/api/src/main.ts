/**
 * VoucherHousingPlatform API - Entry Point
 * 
 * Security configuration from docs/ARCHITECTURE_DISCOVERY.md §7:
 * - Helmet for security headers
 * - CORS with explicit allowlist from env
 * - Rate limiting via @nestjs/throttler
 * - Global validation pipes
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers (§7)
  app.use(helmet());

  // CORS - explicit allowlist, never wildcard in production
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [];
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' 
      ? allowedOrigins 
      : true, // Allow all in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  });

  // Global validation pipe - reject unknown fields
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw error on unknown properties
      transform: true,            // Transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // API prefix
  app.setGlobalPrefix('api', {
    exclude: ['health', 'health/ready', 'health/live'],
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  
  console.log(`🚀 VHP API running on port ${port}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();
