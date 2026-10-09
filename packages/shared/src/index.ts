/**
 * @vhp/shared - Shared types and utilities for VoucherHousingPlatform
 * 
 * This package contains:
 * - Role and permission enums
 * - Common DTOs and interfaces
 * - Validation schemas (shared between frontend/backend)
 * - Utility types
 */

// ============================================================================
// Role & Permission System
// ============================================================================

/**
 * User roles as defined in §2 of Architecture Discovery
 * - admin: Platform admin, org owner
 * - broker: V1 power user, manages client book and showings
 * - assistant: Helps broker with intake, confirmations, follow-up
 * - landlord: Property owner, sees redacted applicant info
 * - tenant: Head of household, sees own case only
 * - auditor: Read-only compliance access
 */
export enum UserRole {
  ADMIN = 'admin',
  BROKER = 'broker',
  ASSISTANT = 'assistant',
  LANDLORD = 'landlord',
  TENANT = 'tenant',
  AUDITOR = 'auditor',
}

/**
 * User account status
 */
export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DEACTIVATED = 'deactivated',
}

// ============================================================================
// Voucher Types (from §8 Data Model)
// ============================================================================

/**
 * Voucher program types
 * Note: Program type is sensitive - HASA implies health status
 * Must never be exposed to landlord-facing surfaces
 */
export enum VoucherProgram {
  CITYFHEPS = 'CITYFHEPS',
  FHEPS = 'FHEPS',
  SECTION8 = 'SECTION8',
  HASA = 'HASA',
  OTHER = 'OTHER',
}

/**
 * Voucher issuance type
 */
export enum IssuanceType {
  NEW = 'NEW',
  TRANSFER = 'TRANSFER',
}

/**
 * Voucher verification state - progressive trust levels
 */
export enum VoucherVerificationState {
  UNVERIFIED = 'UNVERIFIED',
  SELF_REPORTED = 'SELF_REPORTED',
  DOC_VERIFIED = 'DOC_VERIFIED',
  AGENCY_CONFIRMED = 'AGENCY_CONFIRMED',
}

/**
 * Voucher status
 */
export enum VoucherStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  SUSPENDED = 'SUSPENDED',
  UNKNOWN = 'UNKNOWN',
}

// ============================================================================
// Case Workflow (from §9 State Machine)
// ============================================================================

/**
 * Case stages - 15 stages as defined in §9
 * Terminal stages: PLACED, WITHDRAWN, INELIGIBLE
 */
export enum CaseStage {
  INQUIRY = 'INQUIRY',
  INTAKE = 'INTAKE',
  VOUCHER_REVIEW = 'VOUCHER_REVIEW',
  DOCUMENT_COLLECT = 'DOCUMENT_COLLECT',
  READY = 'READY',
  MATCHED = 'MATCHED',
  APPLICATION = 'APPLICATION',
  PRECLEARANCE = 'PRECLEARANCE',
  LEASE_PREP = 'LEASE_PREP',
  LEASE_REVIEW = 'LEASE_REVIEW',
  INSPECTION = 'INSPECTION',
  MOVE_IN_PREP = 'MOVE_IN_PREP',
  PLACED = 'PLACED',
  WITHDRAWN = 'WITHDRAWN',
  INELIGIBLE = 'INELIGIBLE',
}

/**
 * Case outcome reasons
 */
export enum CaseOutcome {
  PLACED = 'PLACED',
  LOST_UNIT = 'LOST_UNIT',
  LOST_TENANT = 'LOST_TENANT',
  INELIGIBLE = 'INELIGIBLE',
  WITHDRAWN = 'WITHDRAWN',
}

// ============================================================================
// Document Management
// ============================================================================

/**
 * Document state
 */
export enum DocumentState {
  UPLOADED = 'UPLOADED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  SUPERSEDED = 'SUPERSEDED',
}

/**
 * Checklist item state
 */
export enum ChecklistItemState {
  MISSING = 'MISSING',
  UPLOADED = 'UPLOADED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  WAIVED = 'WAIVED',
}

/**
 * Document owner types (polymorphic)
 */
export enum DocumentOwnerType {
  CLIENT = 'CLIENT',
  UNIT = 'UNIT',
  LANDLORD = 'LANDLORD',
  CASE = 'CASE',
}

// ============================================================================
// Property & Unit
// ============================================================================

/**
 * Unit status
 */
export enum UnitStatus {
  DRAFT = 'DRAFT',
  AVAILABLE = 'AVAILABLE',
  UNDER_APPLICATION = 'UNDER_APPLICATION',
  LEASED = 'LEASED',
  OFF_MARKET = 'OFF_MARKET',
}

// ============================================================================
// Showing Operations (§5 P5)
// ============================================================================

/**
 * Showing invite status
 */
export enum ShowingInviteStatus {
  INVITED = 'INVITED',
  CONFIRMED = 'CONFIRMED',
  DECLINED = 'DECLINED',
  NO_SHOW = 'NO_SHOW',
  ATTENDED = 'ATTENDED',
  INTERESTED = 'INTERESTED',
  NOT_INTERESTED = 'NOT_INTERESTED',
  APPLICATION_STARTED = 'APPLICATION_STARTED',
}

/**
 * Showing invite priority
 */
export enum ShowingPriority {
  PRIMARY = 'PRIMARY',
  BACKUP = 'BACKUP',
}

// ============================================================================
// Fit Evaluation (§5 P3)
// ============================================================================

/**
 * Fit evaluation result
 * Deterministic, explainable, auditable
 */
export enum FitResult {
  ELIGIBLE = 'ELIGIBLE',
  INELIGIBLE = 'INELIGIBLE',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
}

// ============================================================================
// Task Management
// ============================================================================

/**
 * Task status
 */
export enum TaskStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

// ============================================================================
// Audit Log
// ============================================================================

/**
 * Audit action types
 */
export enum AuditAction {
  // Auth
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  MFA_ENROLLED = 'MFA_ENROLLED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  
  // CRUD
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  
  // Documents
  DOCUMENT_UPLOAD = 'DOCUMENT_UPLOAD',
  DOCUMENT_VIEW = 'DOCUMENT_VIEW',
  DOCUMENT_DOWNLOAD = 'DOCUMENT_DOWNLOAD',
  SIGNED_URL_MINTED = 'SIGNED_URL_MINTED',
  
  // Workflow
  STAGE_TRANSITION = 'STAGE_TRANSITION',
  OVERRIDE = 'OVERRIDE',
  OWNER_CHANGE = 'OWNER_CHANGE',
  
  // Showing
  SHOWING_CREATED = 'SHOWING_CREATED',
  INVITE_SENT = 'INVITE_SENT',
  STATUS_CHANGED = 'STATUS_CHANGED',
  
  // Admin
  ROLE_CHANGED = 'ROLE_CHANGED',
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  PERMISSION_REVOKED = 'PERMISSION_REVOKED',
  
  // Export
  EXPORT = 'EXPORT',
}

// ============================================================================
// Client Pipeline (from UI_UX_DESIGN.md §2.2)
// ============================================================================

/**
 * Client pipeline stages for the broker console
 */
export enum ClientPipelineStage {
  NEW_LEAD = 'NEW_LEAD',
  INTAKE_INCOMPLETE = 'INTAKE_INCOMPLETE',
  DOCUMENTS_NEEDED = 'DOCUMENTS_NEEDED',
  READY_TO_MATCH = 'READY_TO_MATCH',
  MATCHED_TO_PROPERTY = 'MATCHED_TO_PROPERTY',
  SHOWING_SCHEDULED = 'SHOWING_SCHEDULED',
  INTERESTED = 'INTERESTED',
  APPLICATION_SUBMITTED = 'APPLICATION_SUBMITTED',
  APPROVED_LEASED = 'APPROVED_LEASED',
  INACTIVE_LOST = 'INACTIVE_LOST',
}

// ============================================================================
// Common Interfaces
// ============================================================================

/**
 * Base entity with standard fields
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Org-scoped entity
 */
export interface OrgScopedEntity extends BaseEntity {
  orgId: string;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * API error response
 */
export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// Re-exports
// ============================================================================

export * from './auth.js';
