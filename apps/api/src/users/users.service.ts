/**
 * Users Service - User CRUD operations
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { prisma, User, UserRole, UserStatus } from '@vhp/database';
import { AuthService } from '../auth/auth.service';

interface CreateUserDto {
  email: string;
  name: string;
  role: UserRole;
  orgId: string;
  password?: string;
}

interface UpdateUserDto {
  name?: string;
  role?: UserRole;
  status?: UserStatus;
}

@Injectable()
export class UsersService {
  constructor(private readonly authService: AuthService) {}

  async findById(id: string, orgId: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { id, orgId } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async findByOrg(orgId: string, options?: { role?: UserRole; status?: UserStatus }) {
    return prisma.user.findMany({
      where: {
        orgId,
        ...(options?.role && { role: options.role }),
        ...(options?.status && { status: options.status }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateUserDto): Promise<User> {
    // Check for existing user
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Hash password if provided
    let passwordHash: string | undefined;
    if (dto.password) {
      passwordHash = await this.authService.hashPassword(dto.password);
    }

    return prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        name: dto.name,
        role: dto.role,
        orgId: dto.orgId,
        passwordHash,
        status: dto.password ? UserStatus.ACTIVE : UserStatus.PENDING,
      },
    });
  }

  async update(id: string, orgId: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id, orgId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return prisma.user.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.role && { role: dto.role }),
        ...(dto.status && { status: dto.status }),
      },
    });
  }

  async deactivate(id: string, orgId: string, deactivatedBy: string): Promise<User> {
    const user = await this.findById(id, orgId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.DEACTIVATED,
        deactivatedAt: new Date(),
        deactivatedBy,
      },
    });
  }
}
