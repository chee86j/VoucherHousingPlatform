/**
 * Properties Service - CRUD for Landlord, Property, Unit
 * 
 * Ponytail: direct Prisma, org_id scoping, no abstractions.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, Landlord, Property, Unit, UnitStatus } from '@vhp/database';
import { 
  CreateLandlordDto, UpdateLandlordDto,
  CreatePropertyDto, UpdatePropertyDto,
  CreateUnitDto, UpdateUnitDto,
} from './dto/properties.dto';

@Injectable()
export class PropertiesService {
  // =========================================================================
  // Landlord CRUD
  // =========================================================================

  async findAllLandlords(orgId: string, limit = 50, offset = 0): Promise<{ landlords: Landlord[]; total: number }> {
    const [landlords, total] = await Promise.all([
      prisma.landlord.findMany({
        where: { orgId },
        include: { properties: { include: { units: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.landlord.count({ where: { orgId } }),
    ]);
    return { landlords, total };
  }

  async findLandlord(id: string, orgId: string): Promise<Landlord> {
    const landlord = await prisma.landlord.findFirst({
      where: { id, orgId },
      include: { properties: { include: { units: true } } },
    });
    if (!landlord) throw new NotFoundException('Landlord not found');
    return landlord;
  }

  async createLandlord(orgId: string, dto: CreateLandlordDto): Promise<Landlord> {
    return prisma.landlord.create({
      data: {
        orgId,
        legalEntityName: dto.legalEntityName,
        contactName: dto.contactName,
        phone: dto.phone,
        email: dto.email,
        programExperienceLevel: dto.programExperienceLevel,
      },
    });
  }

  async updateLandlord(id: string, orgId: string, dto: UpdateLandlordDto): Promise<Landlord> {
    await this.findLandlord(id, orgId);
    return prisma.landlord.update({
      where: { id },
      data: {
        ...(dto.legalEntityName !== undefined && { legalEntityName: dto.legalEntityName }),
        ...(dto.contactName !== undefined && { contactName: dto.contactName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.programExperienceLevel !== undefined && { programExperienceLevel: dto.programExperienceLevel }),
        ...(dto.bankingVerified !== undefined && { bankingVerified: dto.bankingVerified }),
      },
    });
  }

  // =========================================================================
  // Property CRUD
  // =========================================================================

  async findAllProperties(orgId: string, filters?: {
    borough?: string;
    bedrooms?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ properties: Property[]; total: number }> {
    // Properties belong to landlords which belong to orgs
    const where = {
      landlord: { orgId },
      ...(filters?.borough && { borough: filters.borough }),
    };

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        include: { 
          landlord: true, 
          units: filters?.bedrooms !== undefined 
            ? { where: { bedrooms: filters.bedrooms } } 
            : true,
        },
        orderBy: { createdAt: 'desc' },
        take: filters?.limit ?? 50,
        skip: filters?.offset ?? 0,
      }),
      prisma.property.count({ where }),
    ]);
    return { properties, total };
  }

  async findProperty(id: string, orgId: string): Promise<Property> {
    const property = await prisma.property.findFirst({
      where: { id, landlord: { orgId } },
      include: { landlord: true, units: true },
    });
    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

  async createProperty(orgId: string, dto: CreatePropertyDto): Promise<Property> {
    // Verify landlord belongs to org
    await this.findLandlord(dto.landlordId, orgId);

    return prisma.property.create({
      data: {
        landlordId: dto.landlordId,
        addressLine1: dto.addressLine1,
        city: dto.city ?? 'New York',
        state: dto.state ?? 'NY',
        zip: dto.zip,
        borough: dto.borough,
        hpdRegistrationId: dto.hpdRegistrationId,
        yearBuilt: dto.yearBuilt,
        totalUnits: dto.totalUnits,
      },
      include: { landlord: true, units: true },
    });
  }

  async updateProperty(id: string, orgId: string, dto: UpdatePropertyDto): Promise<Property> {
    await this.findProperty(id, orgId);
    return prisma.property.update({
      where: { id },
      data: {
        ...(dto.addressLine1 !== undefined && { addressLine1: dto.addressLine1 }),
        ...(dto.borough !== undefined && { borough: dto.borough }),
        ...(dto.hpdRegistrationId !== undefined && { hpdRegistrationId: dto.hpdRegistrationId }),
        ...(dto.yearBuilt !== undefined && { yearBuilt: dto.yearBuilt }),
        ...(dto.totalUnits !== undefined && { totalUnits: dto.totalUnits }),
      },
      include: { landlord: true, units: true },
    });
  }

  // =========================================================================
  // Unit CRUD
  // =========================================================================

  async findAllUnits(orgId: string, filters?: {
    bedrooms?: number;
    status?: UnitStatus;
    maxRentCents?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ units: Unit[]; total: number }> {
    const where = {
      property: { landlord: { orgId } },
      ...(filters?.bedrooms !== undefined && { bedrooms: filters.bedrooms }),
      ...(filters?.status && { status: filters.status }),
      ...(filters?.maxRentCents !== undefined && { askingRentCents: { lte: filters.maxRentCents } }),
    };

    const [units, total] = await Promise.all([
      prisma.unit.findMany({
        where,
        include: { property: { include: { landlord: true } } },
        orderBy: { askingRentCents: 'asc' },
        take: filters?.limit ?? 50,
        skip: filters?.offset ?? 0,
      }),
      prisma.unit.count({ where }),
    ]);
    return { units, total };
  }

  async findUnit(id: string, orgId: string): Promise<Unit> {
    const unit = await prisma.unit.findFirst({
      where: { id, property: { landlord: { orgId } } },
      include: { property: { include: { landlord: true } } },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
  }

  async createUnit(propertyId: string, orgId: string, dto: CreateUnitDto): Promise<Unit> {
    // Verify property belongs to org
    await this.findProperty(propertyId, orgId);

    return prisma.unit.create({
      data: {
        propertyId,
        unitNumber: dto.unitNumber,
        bedrooms: dto.bedrooms,
        bathrooms: dto.bathrooms,
        squareFeet: dto.squareFeet,
        askingRentCents: dto.askingRentCents,
        utilitiesIncluded: dto.utilitiesIncluded,
        status: dto.status ?? 'DRAFT',
        availableDate: dto.availableDate ? new Date(dto.availableDate) : null,
        accessibilityFeatures: dto.accessibilityFeatures,
      },
      include: { property: true },
    });
  }

  async updateUnit(id: string, orgId: string, dto: UpdateUnitDto): Promise<Unit> {
    await this.findUnit(id, orgId);
    return prisma.unit.update({
      where: { id },
      data: {
        ...(dto.unitNumber !== undefined && { unitNumber: dto.unitNumber }),
        ...(dto.bedrooms !== undefined && { bedrooms: dto.bedrooms }),
        ...(dto.bathrooms !== undefined && { bathrooms: dto.bathrooms }),
        ...(dto.squareFeet !== undefined && { squareFeet: dto.squareFeet }),
        ...(dto.askingRentCents !== undefined && { askingRentCents: dto.askingRentCents }),
        ...(dto.utilitiesIncluded !== undefined && { utilitiesIncluded: dto.utilitiesIncluded }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.availableDate !== undefined && { availableDate: dto.availableDate ? new Date(dto.availableDate) : null }),
        ...(dto.accessibilityFeatures !== undefined && { accessibilityFeatures: dto.accessibilityFeatures }),
      },
      include: { property: true },
    });
  }
}
