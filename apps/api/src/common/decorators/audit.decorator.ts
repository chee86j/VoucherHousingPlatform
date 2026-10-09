/**
 * Audit decorators for fine-grained control
 */

import { SetMetadata } from '@nestjs/common';

export const SKIP_AUDIT_KEY = 'skipAudit';
export const AUDIT_ACTION_KEY = 'auditAction';

/**
 * Skip audit logging for this endpoint
 * Use sparingly - most operations should be audited
 */
export const SkipAudit = () => SetMetadata(SKIP_AUDIT_KEY, true);

/**
 * Set a specific audit action for this endpoint
 * Overrides the default action derived from HTTP method
 */
export const AuditAction = (action: string) => SetMetadata(AUDIT_ACTION_KEY, action);
