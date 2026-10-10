/**
 * Properties DTOs
 * 
 * Ponytail: minimal fields from §8, use class-validator.
 */

import { IsString, IsOptional, IsInt, IsNumber, IsEnum, Min, IsDateString, IsBoolean, IsEmail } from 'class-validator';
import { UnitStatus } from '@vhp/database';

// =========================================================================
// Landlord DTOs
// =========================================================================

export class CreateLandlordDto {
  @IsString()
  legalEntityName: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  programExperienceLevel?: string;
}

export class UpdateLandlordDto {
  @IsOptional()
  @IsString()
  legalEntityName?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  programExperienceLevel?: string;

  @IsOptional()
  @IsBoolean()
  bankingVerified?: boolean;
}

// =========================================================================
// Property DTOs
// =========================================================================

export class CreatePropertyDto {
  @IsString()
  landlordId: string;

  @IsString()
  addressLine1: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsString()
  zip: string;

  @IsOptional()
  @IsString()
  borough?: string;

  @IsOptional()
  @IsString()
  hpdRegistrationId?: string;

  @IsOptional()
  @IsInt()
  yearBuilt?: number;

  @IsOptional()
  @IsInt()
  totalUnits?: number;
}

export class UpdatePropertyDto {
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  borough?: string;

  @IsOptional()
  @IsString()
  hpdRegistrationId?: string;

  @IsOptional()
  @IsInt()
  yearBuilt?: number;

  @IsOptional()
  @IsInt()
  totalUnits?: number;
}

// =========================================================================
// Unit DTOs
// =========================================================================

export class CreateUnitDto {
  @IsOptional()
  @IsString()
  unitNumber?: string;

  @IsInt()
  @Min(0)
  bedrooms: number;

  @IsOptional()
  @IsNumber()
  bathrooms?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  squareFeet?: number;

  @IsInt()
  @Min(0)
  askingRentCents: number;

  @IsOptional()
  utilitiesIncluded?: Record<string, boolean>;

  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;

  @IsOptional()
  @IsDateString()
  availableDate?: string;

  @IsOptional()
  accessibilityFeatures?: Record<string, boolean>;
}

export class UpdateUnitDto {
  @IsOptional()
  @IsString()
  unitNumber?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  bedrooms?: number;

  @IsOptional()
  @IsNumber()
  bathrooms?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  squareFeet?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  askingRentCents?: number;

  @IsOptional()
  utilitiesIncluded?: Record<string, boolean>;

  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;

  @IsOptional()
  @IsDateString()
  availableDate?: string;

  @IsOptional()
  accessibilityFeatures?: Record<string, boolean>;
}
