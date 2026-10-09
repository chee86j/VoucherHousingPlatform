/**
 * Health Controller - Kubernetes-style health probes
 * 
 * /health - Overall health
 * /health/live - Liveness probe (is the process running)
 * /health/ready - Readiness probe (can we serve traffic)
 */

import { Controller, Get } from '@nestjs/common';
import { SkipAudit } from '../common/decorators/audit.decorator';
import { prisma } from '@vhp/database';

@Controller('health')
export class HealthController {
  /**
   * Overall health check
   */
  @Get()
  @SkipAudit()
  async health() {
    const dbHealthy = await this.checkDatabase();
    
    return {
      status: dbHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      checks: {
        database: dbHealthy ? 'ok' : 'failed',
      },
    };
  }

  /**
   * Liveness probe - is the process running?
   */
  @Get('live')
  @SkipAudit()
  live() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness probe - can we serve traffic?
   */
  @Get('ready')
  @SkipAudit()
  async ready() {
    const dbHealthy = await this.checkDatabase();
    
    if (!dbHealthy) {
      return {
        status: 'not ready',
        reason: 'Database connection failed',
      };
    }

    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
