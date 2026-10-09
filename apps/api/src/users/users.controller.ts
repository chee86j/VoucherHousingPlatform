/**
 * Users Controller - User management endpoints
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@vhp/database';

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get current user profile
   */
  @Get('me')
  async getCurrentUser(@CurrentUser() user: any) {
    const fullUser = await this.usersService.findById(user.id);
    return {
      id: fullUser?.id,
      email: fullUser?.email,
      name: fullUser?.name,
      role: fullUser?.role,
      orgId: fullUser?.orgId,
      mfaEnrolled: fullUser?.mfaEnrolled,
      status: fullUser?.status,
      lastLoginAt: fullUser?.lastLoginAt,
    };
  }

  /**
   * List users in org (admin/broker only)
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.BROKER)
  async listUsers(
    @CurrentUser() user: { orgId: string },
    @Query('role') role?: UserRole,
  ) {
    const users = await this.usersService.findByOrg(user.orgId, { role });
    
    // Redact sensitive fields
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      status: u.status,
      mfaEnrolled: u.mfaEnrolled,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    }));
  }

  /**
   * Get user by ID (admin/broker only)
   */
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.BROKER)
  async getUser(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      return null;
    }
    
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      mfaEnrolled: user.mfaEnrolled,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  /**
   * Create new user (admin only)
   */
  @Post()
  @Roles(UserRole.ADMIN)
  async createUser(
    @Body() dto: { email: string; name: string; role: UserRole; password?: string },
    @CurrentUser() user: { orgId: string },
  ) {
    const newUser = await this.usersService.create({
      ...dto,
      orgId: user.orgId,
    });
    
    return {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      status: newUser.status,
    };
  }

  /**
   * Update user (admin only)
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async updateUser(
    @Param('id') id: string,
    @Body() dto: { name?: string; role?: UserRole },
  ) {
    const updated = await this.usersService.update(id, dto);
    
    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      status: updated.status,
    };
  }

  /**
   * Deactivate user (admin only)
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async deactivateUser(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    const deactivated = await this.usersService.deactivate(id, user.id);
    
    return {
      id: deactivated.id,
      status: deactivated.status,
      deactivatedAt: deactivated.deactivatedAt,
    };
  }
}
