/**
 * Roles Decorator - Restrict access by role
 */

import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@vhp/database';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
