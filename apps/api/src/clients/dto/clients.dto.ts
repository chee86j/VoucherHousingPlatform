/**
 * Client DTOs - Request validation
 * 
 * Ponytail: minimal fields, use class-validator (already installed).
 */

import { IsString, IsOptional, IsEmail, IsEnum, IsInt, IsBoolean, Min, IsDateString } from 'class-validator';
import { ClientPipelineStage, VoucherProgram, IssuanceType, VoucherStatus } from '@vhp/database';

// =========================================================================
// Client DTOs
// =========================================================================

export class CreateClientDto {
  @IsString()
  legalName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  preferredLanguage?: string;

  @IsOptional()
  @IsString()
  currentHousingStatus?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  assignedBrokerId?: string;
}

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  preferredLanguage?: string;

  @IsOptional()
  @IsString()
  currentHousingStatus?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(ClientPipelineStage)
  pipelineStage?: ClientPipelineStage;

  @IsOptional()
  @IsString()
  assignedBrokerId?: string;
}

// =========================================================================
// Voucher DTOs
// =========================================================================

export class CreateVoucherDto {
  @IsEnum(VoucherProgram)
  program: VoucherProgram;

  @IsOptional()
  @IsEnum(IssuanceType)
  issuanceType?: IssuanceType;

  @IsOptional()
  @IsEnum(VoucherStatus)
  status?: VoucherStatus;

  @IsInt()
  @Min(0)
  bedroomsApproved: number;

  @IsInt()
  @Min(0)
  maxRentCents: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  tenantPortionCents?: number;

  @IsOptional()
  utilityResponsibility?: Record<string, boolean>;

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  agencyCaseRef?: string;
}

// =========================================================================
// Household Member DTOs
// =========================================================================

export class CreateHouseholdMemberDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsString()
  relationship: string;

  @IsOptional()
  @IsBoolean()
  isMinor?: boolean;

  @IsOptional()
  @IsBoolean()
  incomeContributor?: boolean;
}
