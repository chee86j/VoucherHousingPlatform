/**
 * Audit Interceptor - Automatic audit logging for all operations
 * 
 * From docs/ARCHITECTURE_DISCOVERY.md §7, §10 R6:
 * - Append-only audit log
 * - Hash-chained for tamper detection
 * - Records: actor, action, resource, timestamp, IP, user agent
 * - Every document read is audited
 * 
 * This interceptor runs on every request after guards.
 * The audit log service handles hash-chaining.
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { AuditService } from '../../auth/audit.service';
import { SKIP_AUDIT_KEY, AUDIT_ACTION_KEY } from '../decorators/audit.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Check if audit should be skipped
    const skipAudit = this.reflector.getAllAndOverride<boolean>(SKIP_AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipAudit) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();

    // Extract audit context
    const auditContext = {
      method: request.method,
      path: request.path,
      ip: request.ip || request.connection?.remoteAddress,
      userAgent: request.headers['user-agent'],
      userId: request.user?.id || null,
      orgId: request.user?.orgId || null,
      requestId: request.headers['x-request-id'] || this.generateRequestId(),
    };

    // Get custom audit action from decorator, or derive from method
    const customAction = this.reflector.get<string>(
      AUDIT_ACTION_KEY,
      context.getHandler(),
    );

    return next.handle().pipe(
      tap(async (response) => {
        const duration = Date.now() - startTime;
        
        // Only audit significant operations
        if (this.shouldAudit(request.method, request.path)) {
          await this.auditService.log({
            action: customAction || this.deriveAction(request.method),
            resourceType: this.extractResourceType(request.path),
            resourceId: request.params?.id || null,
            actorUserId: auditContext.userId,
            actorIp: auditContext.ip,
            actorUserAgent: auditContext.userAgent,
            orgId: auditContext.orgId,
            metadata: {
              requestId: auditContext.requestId,
              duration,
              statusCode: 200,
            },
          });
        }
      }),
      catchError(async (error) => {
        const duration = Date.now() - startTime;

        // Audit failures at elevated severity
        if (this.shouldAuditError(error)) {
          await this.auditService.log({
            action: customAction || this.deriveAction(request.method),
            resourceType: this.extractResourceType(request.path),
            resourceId: request.params?.id || null,
            actorUserId: auditContext.userId,
            actorIp: auditContext.ip,
            actorUserAgent: auditContext.userAgent,
            orgId: auditContext.orgId,
            severity: 'ELEVATED',
            metadata: {
              requestId: auditContext.requestId,
              duration,
              statusCode: error.status || 500,
              errorMessage: error.message,
            },
          });
        }

        throw error;
      }),
    );
  }

  private shouldAudit(method: string, path: string): boolean {
    // Skip health checks
    if (path.startsWith('/health')) return false;
    
    // Audit all mutations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return true;
    
    // Audit specific read paths (document access, etc.)
    if (path.includes('/documents/') || path.includes('/cases/')) return true;
    
    return false;
  }

  private shouldAuditError(error: any): boolean {
    // Audit auth failures
    if (error.status === 401 || error.status === 403) return true;
    
    // Audit server errors
    if (error.status >= 500) return true;
    
    return false;
  }

  private deriveAction(method: string): string {
    const methodToAction: Record<string, string> = {
      GET: 'READ',
      POST: 'CREATE',
      PUT: 'UPDATE',
      PATCH: 'UPDATE',
      DELETE: 'DELETE',
    };
    return methodToAction[method] || 'UNKNOWN';
  }

  private extractResourceType(path: string): string {
    // Extract resource type from path: /api/users/123 -> users
    const parts = path.split('/').filter(Boolean);
    const apiIndex = parts.indexOf('api');
    if (apiIndex >= 0 && parts[apiIndex + 1]) {
      return parts[apiIndex + 1].toUpperCase();
    }
    return parts[0]?.toUpperCase() || 'UNKNOWN';
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
