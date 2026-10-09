/**
 * Database seed script for development
 * 
 * Creates:
 * - Platform organization
 * - Default admin user
 * - Sample broker organization with users
 */

import { PrismaClient, UserRole, UserStatus, OrgType } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Simple password hash for dev (in prod, use argon2id)
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'dev-salt').digest('hex');
}

async function main() {
  console.log('🌱 Seeding database...');

  // Create platform org (for system admins)
  const platformOrg = await prisma.organization.upsert({
    where: { slug: 'platform' },
    update: {},
    create: {
      name: 'VHP Platform',
      slug: 'platform',
      type: OrgType.PLATFORM,
      settings: {},
    },
  });
  console.log('✅ Created platform organization:', platformOrg.id);

  // Create platform admin
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@vhp.local' },
    update: {},
    create: {
      orgId: platformOrg.id,
      email: 'admin@vhp.local',
      emailVerified: new Date(),
      name: 'Platform Admin',
      passwordHash: hashPassword('admin123!@#'),
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      mfaEnrolled: false, // Skip MFA in dev
    },
  });
  console.log('✅ Created admin user:', adminUser.email);

  // Create sample broker organization
  const brokerOrg = await prisma.organization.upsert({
    where: { slug: 'acme-realty' },
    update: {},
    create: {
      name: 'Acme Realty',
      slug: 'acme-realty',
      type: OrgType.BROKER,
      settings: {},
    },
  });
  console.log('✅ Created broker organization:', brokerOrg.id);

  // Create sample broker user
  const brokerUser = await prisma.user.upsert({
    where: { email: 'broker@acme-realty.local' },
    update: {},
    create: {
      orgId: brokerOrg.id,
      email: 'broker@acme-realty.local',
      emailVerified: new Date(),
      name: 'Jane Broker',
      passwordHash: hashPassword('broker123!@#'),
      role: UserRole.BROKER,
      status: UserStatus.ACTIVE,
      mfaEnrolled: false,
    },
  });
  console.log('✅ Created broker user:', brokerUser.email);

  // Create sample assistant user
  const assistantUser = await prisma.user.upsert({
    where: { email: 'assistant@acme-realty.local' },
    update: {},
    create: {
      orgId: brokerOrg.id,
      email: 'assistant@acme-realty.local',
      emailVerified: new Date(),
      name: 'Bob Assistant',
      passwordHash: hashPassword('assistant123!@#'),
      role: UserRole.ASSISTANT,
      status: UserStatus.ACTIVE,
      mfaEnrolled: false,
    },
  });
  console.log('✅ Created assistant user:', assistantUser.email);

  // Create sample auditor user
  const auditorUser = await prisma.user.upsert({
    where: { email: 'auditor@vhp.local' },
    update: {},
    create: {
      orgId: platformOrg.id,
      email: 'auditor@vhp.local',
      emailVerified: new Date(),
      name: 'Audit Compliance',
      passwordHash: hashPassword('auditor123!@#'),
      role: UserRole.AUDITOR,
      status: UserStatus.ACTIVE,
      mfaEnrolled: false,
    },
  });
  console.log('✅ Created auditor user:', auditorUser.email);

  console.log('');
  console.log('🎉 Seeding complete!');
  console.log('');
  console.log('Development credentials:');
  console.log('  Admin:     admin@vhp.local / admin123!@#');
  console.log('  Broker:    broker@acme-realty.local / broker123!@#');
  console.log('  Assistant: assistant@acme-realty.local / assistant123!@#');
  console.log('  Auditor:   auditor@vhp.local / auditor123!@#');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
