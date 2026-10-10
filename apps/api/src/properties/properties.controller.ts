/**
 * Properties Controller - REST endpoints for Landlord, Property, Unit
 * 
 * Authorization from §7:
 * - ADMIN, BROKER can manage landlords/properties/units
 * - ASSISTANT can read properties/units, cannot manage landlords
 * - LANDLORD sees only their own properties (separate endpoint Phase 4)
 * - AUDITOR has read-only access
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PropertiesService } from './properties.service';
import {
  CreateLandlordDto, UpdateLandlordDto,
  CreatePropertyDto, UpdatePropertyDto,
  CreateUnitDto, UpdateUnitDto,
} from './dto/properties.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, UnitStatus } from '@vhp/database';

interface AuthUser {
  id: string;
  orgId: string;
  role: UserRole;
}

@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  // =========================================================================
  // Landlord endpoints
  // =========================================================================

  @Get('landlords')
  @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.AUDITOR)
  async findAllLandlords(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.propertiesService.findAllLandlords(
      user.orgId,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
  }

  @Get('landlords/:id')
  @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.AUDITOR)
  async findLandlord(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.propertiesService.findLandlord(id, user.orgId);
  }

  @Post('landlords')
  @Roles(UserRole.ADMIN, UserRole.BROKER)
  async createLandlord(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateLandlordDto,
  ) {
    return this.propertiesService.createLandlord(user.orgId, dto);
  }

  @Patch('landlords/:id')
  @Roles(UserRole.ADMIN, UserRole.BROKER)
  async updateLandlord(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateLandlordDto,
  ) {
    return this.propertiesService.updateLandlord(id, user.orgId, dto);
  }

  // =========================================================================
  // Property endpoints
  // =========================================================================

  @Get('properties')
  @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT, UserRole.AUDITOR)
  async findAllProperties(
    @CurrentUser() user: AuthUser,
    @Query('borough') borough?: string,
    @Query('bedrooms') bedrooms?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.propertiesService.findAllProperties(user.orgId, {
      borough,
      bedrooms: bedrooms ? parseInt(bedrooms, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('properties/:id')
  @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT, UserRole.AUDITOR)
  async findProperty(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.propertiesService.findProperty(id, user.orgId);
  }

  @Post('properties')
  @Roles(UserRole.ADMIN, UserRole.BROKER)
  async createProperty(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePropertyDto,
  ) {
    return this.propertiesService.createProperty(user.orgId, dto);
  }

  @Patch('properties/:id')
  @Roles(UserRole.ADMIN, UserRole.BROKER)
  async updateProperty(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.propertiesService.updateProperty(id, user.orgId, dto);
  }

  // =========================================================================
  // Unit endpoints
  // =========================================================================

  @Get('units')
  @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT, UserRole.AUDITOR)
  async findAllUnits(
    @CurrentUser() user: AuthUser,
    @Query('bedrooms') bedrooms?: string,
    @Query('status') status?: UnitStatus,
    @Query('maxRentCents') maxRentCents?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.propertiesService.findAllUnits(user.orgId, {
      bedrooms: bedrooms ? parseInt(bedrooms, 10) : undefined,
      status,
      maxRentCents: maxRentCents ? parseInt(maxRentCents, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('units/:id')
  @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT, UserRole.AUDITOR)
  async findUnit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.propertiesService.findUnit(id, user.orgId);
  }

  @Post('properties/:propertyId/units')
  @Roles(UserRole.ADMIN, UserRole.BROKER)
  async createUnit(
    @CurrentUser() user: AuthUser,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateUnitDto,
  ) {
    return this.propertiesService.createUnit(propertyId, user.orgId, dto);
  }

  @Patch('units/:id')
  @Roles(UserRole.ADMIN, UserRole.BROKER)
  async updateUnit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUnitDto,
  ) {
    return this.propertiesService.updateUnit(id, user.orgId, dto);
  }
}
