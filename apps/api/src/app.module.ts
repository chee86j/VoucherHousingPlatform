/**
 * Root Application Module
 * 
 * Cross-cutting concerns from docs/ARCHITECTURE_DISCOVERY.md §7:
 * - AuthGuard → PolicyGuard → AuditInterceptor chain
 * - Rate limiting via ThrottlerModule
 * - Configuration via ConfigModule
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HealthModule } from './health/health.module';
import { ClientsModule } from './clients/clients.module';
import { PropertiesModule } from './properties/properties.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

@Module({
  imports: [
    // Environment configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting - configurable per route
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'short',
          ttl: 1000,  // 1 second
          limit: 10,  // 10 requests per second
        },
        {
          name: 'medium',
          ttl: 10000, // 10 seconds
          limit: 50,  // 50 requests per 10 seconds
        },
        {
          name: 'long',
          ttl: 60000, // 1 minute
          limit: 100, // 100 requests per minute
        },
      ],
    }),

    // Feature modules
    AuthModule,
    UsersModule,
    HealthModule,
    ClientsModule,
    PropertiesModule,
  ],
  providers: [
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    // Global audit interceptor - logs all operations
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },

    // Global exception filter - sanitizes error responses
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
