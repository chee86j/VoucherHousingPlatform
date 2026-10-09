/**
 * Audit Service - Hash-chained append-only audit logging
 * 
 * From docs/ARCHITECTURE_DISCOVERY.md §7, §10 R6:
 * - Append-only log (INSERT only, no UPDATE/DELETE)
 * - Hash-chained: each row includes previous row's hash
 * - Records all sensitive operations
 * - Tamper-evident design
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { prisma, AuditAction, AuditSeverity } from '@vhp/database';

interface AuditLogEntry {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  actorUserId?: string | null;
  actorIp?: string | null;
  actorUserAgent?: string | null;
  orgId?: string | null;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  reason?: string;
  severity?: 'LOW' | 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private lastHash: string | null = null;

  constructor() {
    // Initialize last hash from database on startup
    this.initializeLastHash();
  }

  private async initializeLastHash(): Promise<void> {
    try {
      const lastEntry = await prisma.auditLog.findFirst({
        orderBy: { occurredAt: 'desc' },
        select: { hash: true },
      });
      this.lastHash = lastEntry?.hash || null;
    } catch (error) {
      this.logger.warn('Failed to initialize audit hash chain', error);
    }
  }

  /**
   * Log an auditable event with hash chaining
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Map string action to enum (or use as-is if already valid)
      const action = this.mapToAuditAction(entry.action);
      const severity = this.mapToSeverity(entry.severity);

      // Generate hash for this entry
      const hashInput = JSON.stringify({
        action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        actorUserId: entry.actorUserId,
        timestamp: new Date().toISOString(),
        prevHash: this.lastHash,
      });
      const hash = createHash('sha256').update(hashInput).digest('hex');

      // Determine org_id - use provided or system org
      const orgId = entry.orgId || await this.getSystemOrgId();

      // Insert audit log entry
      await prisma.auditLog.create({
        data: {
          orgId,
          actorUserId: entry.actorUserId,
          actorIp: entry.actorIp,
          actorUserAgent: entry.actorUserAgent?.substring(0, 500), // Truncate UA
          action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          beforeState: entry.beforeState || undefined,
          afterState: entry.afterState || entry.metadata || undefined,
          reason: entry.reason,
          severity,
          prevHash: this.lastHash,
          hash,
        },
      });

      // Update chain for next entry
      this.lastHash = hash;

      // Log to stdout for debugging (remove in production)
      if (process.env.NODE_ENV === 'development') {
        this.logger.debug(`Audit: ${action} on ${entry.resourceType}/${entry.resourceId || 'N/A'}`);
      }
    } catch (error) {
      // Audit failures should never break the application
      // but they should be logged loudly
      this.logger.error('CRITICAL: Audit log write failed', error);
      
      // In production, consider alerting on audit failures
      // as they could indicate tampering attempts
    }
  }

  /**
   * Log a document access event (required per §7)
   */
  async logDocumentAccess(
    documentId: string,
    action: 'VIEW' | 'DOWNLOAD' | 'SIGNED_URL_MINTED',
    actor: { userId: string; orgId: string; ip?: string; userAgent?: string },
  ): Promise<void> {
    const actionMap = {
      VIEW: AuditAction.DOCUMENT_VIEW,
      DOWNLOAD: AuditAction.DOCUMENT_DOWNLOAD,
      SIGNED_URL_MINTED: AuditAction.SIGNED_URL_MINTED,
    };

    await this.log({
      action: actionMap[action],
      resourceType: 'DOCUMENT',
      resourceId: documentId,
      actorUserId: actor.userId,
      actorIp: actor.ip,
      actorUserAgent: actor.userAgent,
      orgId: actor.orgId,
      severity: 'NORMAL',
    });
  }

  /**
   * Log a stage transition (required per §9)
   */
  async logStageTransition(
    caseId: string,
    fromStage: string,
    toStage: string,
    actor: { userId: string; orgId: string; ip?: string },
    reason?: string,
    isOverride: boolean = false,
  ): Promise<void> {
    await this.log({
      action: isOverride ? AuditAction.OVERRIDE : AuditAction.STAGE_TRANSITION,
      resourceType: 'CASE',
      resourceId: caseId,
      actorUserId: actor.userId,
      actorIp: actor.ip,
      orgId: actor.orgId,
      beforeState: { stage: fromStage },
      afterState: { stage: toStage },
      reason,
      severity: isOverride ? 'ELEVATED' : 'NORMAL',
    });
  }

  /**
   * Log authentication events
   */
  async logAuth(
    event: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED' | 'MFA_ENROLLED' | 'MFA_VERIFIED',
    userId: string | null,
    metadata: { email?: string; ip?: string; userAgent?: string; orgId?: string },
  ): Promise<void> {
    const actionMap: Record<string, AuditAction> = {
      LOGIN: AuditAction.LOGIN,
      LOGOUT: AuditAction.LOGOUT,
      LOGIN_FAILED: AuditAction.LOGIN_FAILED,
      MFA_ENROLLED: AuditAction.MFA_ENROLLED,
      MFA_VERIFIED: AuditAction.MFA_VERIFIED,
    };

    await this.log({
      action: actionMap[event],
      resourceType: 'AUTH',
      resourceId: userId || metadata.email,
      actorUserId: userId,
      actorIp: metadata.ip,
      actorUserAgent: metadata.userAgent,
      orgId: metadata.orgId,
      severity: event === 'LOGIN_FAILED' ? 'ELEVATED' : 'NORMAL',
    });
  }

  private mapToAuditAction(action: string): AuditAction {
    // If it's already a valid enum value, return it
    if (Object.values(AuditAction).includes(action as AuditAction)) {
      return action as AuditAction;
    }

    // Map common actions
    const map: Record<string, AuditAction> = {
      READ: AuditAction.READ,
      CREATE: AuditAction.CREATE,
      UPDATE: AuditAction.UPDATE,
      DELETE: AuditAction.DELETE,
    };

    return map[action] || AuditAction.READ;
  }

  private mapToSeverity(severity?: string): AuditSeverity {
    if (!severity) return AuditSeverity.NORMAL;
    
    const map: Record<string, AuditSeverity> = {
      LOW: AuditSeverity.LOW,
      NORMAL: AuditSeverity.NORMAL,
      ELEVATED: AuditSeverity.ELEVATED,
      HIGH: AuditSeverity.HIGH,
      CRITICAL: AuditSeverity.CRITICAL,
    };

    return map[severity] || AuditSeverity.NORMAL;
  }

  private async getSystemOrgId(): Promise<string> {
    // Get or create a system org for audit entries without org context
    const systemOrg = await prisma.organization.findFirst({
      where: { slug: 'platform' },
      select: { id: true },
    });

    if (systemOrg) return systemOrg.id;

    // Create if doesn't exist (should be done in seed)
    const newOrg = await prisma.organization.create({
      data: {
        name: 'VHP Platform',
        slug: 'platform',
        type: 'PLATFORM',
      },
      select: { id: true },
    });

    return newOrg.id;
  }
}
