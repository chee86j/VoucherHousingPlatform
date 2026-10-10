/**
 * Clients Controller - REST endpoints for Client aggregate
 * 
 * Authorization from §7:
 * - ADMIN, BROKER, ASSISTANT can list/view/create/update clients in their org
 * - LANDLORD cannot see client PII (separate redacted endpoint in Phase 4)
 * - TENANT sees only their own case (via /me, not here)
 * - AUDITOR has read-only access
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { 
  CreateClientDto, 
  UpdateClientDto, 
  CreateVoucherDto, 
  CreateHouseholdMemberDto 
} from './dto/clients.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, ClientPipelineStage } from '@vhp/database';

interface AuthUser {
  id: string;
  orgId: string;
  role: UserRole;
}

@Controller('api/clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  // =========================================================================
  // Client CRUD
  // =========================================================================

  @Get()
  @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT, UserRole.AUDITOR)
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('pipelineStage') pipelineStage?: ClientPipelineStage,
    @Query('assignedBrokerId') assignedBrokerId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.clientsService.findAll(user.orgId, {
      pipelineStage,
      assignedBrokerId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT, UserRole.AUDITOR)
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.clientsService.findOne(id, user.orgId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT)
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateClientDto,
  ) {
    return this.clientsService.create(user.orgId, dto, user.id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT)
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(id, user.orgId, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.BROKER)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    await this.clientsService.remove(id, user.orgId);
    return { success: true };
  }

  // =========================================================================
  // Voucher operations (nested under client)
  // =========================================================================

  @Post(':clientId/vouchers')
  @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT)
  async addVoucher(
    @CurrentUser() user: AuthUser,
    @Param('clientId') clientId: string,
    @Body() dto: CreateVoucherDto,
  ) {
    return this.clientsService.addVoucher(clientId, user.orgId, dto);
  }

  @Patch(':clientId/vouchers/:voucherId/verify')
  @Roles(UserRole.ADMIN, UserRole.BROKER)
  async verifyVoucher(
    @CurrentUser() user: AuthUser,
    @Param('clientId') clientId: string,
    @Param('voucherId') voucherId: string,
    @Body('verificationState') verificationState: string,
  ) {
    return this.clientsService.updateVoucherVerification(
      voucherId,
      clientId,
      user.orgId,
      verificationState,
      user.id,
    );
  }

  // =========================================================================
  // Household member operations (nested under client)
  // =========================================================================

  @Post(':clientId/household')
  @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT)
  async addHouseholdMember(
    @CurrentUser() user: AuthUser,
    @Param('clientId') clientId: string,
    @Body() dto: CreateHouseholdMemberDto,
  ) {
    return this.clientsService.addHouseholdMember(clientId, user.orgId, dto);
  }

  @Delete(':clientId/household/:memberId')
  @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT)
  async removeHouseholdMember(
    @CurrentUser() user: AuthUser,
    @Param('clientId') clientId: string,
    @Param('memberId') memberId: string,
  ) {
    await this.clientsService.removeHouseholdMember(memberId, clientId, user.orgId);
    return { success: true };
  }
}
