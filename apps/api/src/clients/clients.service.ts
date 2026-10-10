/**
 * Clients Service - CRUD for Client aggregate
 * 
 * Ponytail: minimal methods, direct Prisma calls, no abstractions.
 * Security: org_id scoping enforced on every query.
 */

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { prisma, Client, Voucher, HouseholdMember, ClientPipelineStage } from '@vhp/database';
import { CreateClientDto, UpdateClientDto, CreateVoucherDto, CreateHouseholdMemberDto } from './dto/clients.dto';

@Injectable()
export class ClientsService {
  /**
   * List clients for an organization
   * Broker sees all in their org; tenant sees nothing here (uses /me endpoint)
   */
  async findAll(orgId: string, filters?: {
    pipelineStage?: ClientPipelineStage;
    assignedBrokerId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ clients: Client[]; total: number }> {
    const where = {
      orgId,
      ...(filters?.pipelineStage && { pipelineStage: filters.pipelineStage }),
      ...(filters?.assignedBrokerId && { assignedBrokerId: filters.assignedBrokerId }),
    };

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        include: { vouchers: true, householdMembers: { where: { removedAt: null } } },
        orderBy: { updatedAt: 'desc' },
        take: filters?.limit ?? 50,
        skip: filters?.offset ?? 0,
      }),
      prisma.client.count({ where }),
    ]);

    return { clients, total };
  }

  /**
   * Get single client by ID
   * Enforces org_id match
   */
  async findOne(id: string, orgId: string): Promise<Client> {
    const client = await prisma.client.findFirst({
      where: { id, orgId },
      include: { 
        vouchers: true, 
        householdMembers: { where: { removedAt: null } },
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client;
  }

  /**
   * Create client
   */
  async create(orgId: string, dto: CreateClientDto, createdByUserId: string): Promise<Client> {
    return prisma.client.create({
      data: {
        orgId,
        legalName: dto.legalName,
        phone: dto.phone,
        email: dto.email,
        preferredLanguage: dto.preferredLanguage,
        currentHousingStatus: dto.currentHousingStatus,
        notes: dto.notes,
        assignedBrokerId: dto.assignedBrokerId ?? createdByUserId,
        pipelineStage: 'NEW_LEAD',
      },
      include: { vouchers: true, householdMembers: true },
    });
  }

  /**
   * Update client
   */
  async update(id: string, orgId: string, dto: UpdateClientDto): Promise<Client> {
    // Verify exists and org match
    await this.findOne(id, orgId);

    return prisma.client.update({
      where: { id },
      data: {
        ...(dto.legalName !== undefined && { legalName: dto.legalName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.preferredLanguage !== undefined && { preferredLanguage: dto.preferredLanguage }),
        ...(dto.currentHousingStatus !== undefined && { currentHousingStatus: dto.currentHousingStatus }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.pipelineStage !== undefined && { pipelineStage: dto.pipelineStage }),
        ...(dto.assignedBrokerId !== undefined && { assignedBrokerId: dto.assignedBrokerId }),
      },
      include: { vouchers: true, householdMembers: { where: { removedAt: null } } },
    });
  }

  /**
   * Soft delete - move to INACTIVE_LOST stage
   * We don't hard delete clients (audit trail requirement)
   */
  async remove(id: string, orgId: string): Promise<void> {
    await this.findOne(id, orgId);
    await prisma.client.update({
      where: { id },
      data: { pipelineStage: 'INACTIVE_LOST' },
    });
  }

  // =========================================================================
  // Voucher operations (nested under client)
  // =========================================================================

  async addVoucher(clientId: string, orgId: string, dto: CreateVoucherDto): Promise<Voucher> {
    // Verify client exists and org match
    await this.findOne(clientId, orgId);

    return prisma.voucher.create({
      data: {
        clientId,
        program: dto.program,
        issuanceType: dto.issuanceType ?? 'NEW',
        status: dto.status ?? 'PENDING',
        bedroomsApproved: dto.bedroomsApproved,
        maxRentCents: dto.maxRentCents,
        tenantPortionCents: dto.tenantPortionCents,
        utilityResponsibility: dto.utilityResponsibility,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        agencyCaseRef: dto.agencyCaseRef,
      },
    });
  }

  async updateVoucherVerification(
    voucherId: string, 
    clientId: string, 
    orgId: string,
    verificationState: string,
    verifiedByUserId: string,
  ): Promise<Voucher> {
    // Verify client/org
    await this.findOne(clientId, orgId);

    const voucher = await prisma.voucher.findFirst({
      where: { id: voucherId, clientId },
    });

    if (!voucher) {
      throw new NotFoundException('Voucher not found');
    }

    return prisma.voucher.update({
      where: { id: voucherId },
      data: {
        verificationState: verificationState as any,
        verifiedBy: verifiedByUserId,
        verifiedAt: new Date(),
      },
    });
  }

  // =========================================================================
  // Household member operations (nested under client)
  // =========================================================================

  async addHouseholdMember(clientId: string, orgId: string, dto: CreateHouseholdMemberDto): Promise<HouseholdMember> {
    await this.findOne(clientId, orgId);

    return prisma.householdMember.create({
      data: {
        clientId,
        name: dto.name,
        dob: dto.dob ? new Date(dto.dob) : null,
        relationship: dto.relationship,
        isMinor: dto.isMinor ?? false,
        incomeContributor: dto.incomeContributor ?? false,
      },
    });
  }

  async removeHouseholdMember(memberId: string, clientId: string, orgId: string): Promise<void> {
    await this.findOne(clientId, orgId);

    const member = await prisma.householdMember.findFirst({
      where: { id: memberId, clientId },
    });

    if (!member) {
      throw new NotFoundException('Household member not found');
    }

    // Soft delete
    await prisma.householdMember.update({
      where: { id: memberId },
      data: { removedAt: new Date() },
    });
  }
}
