/**
 * Authorization Matrix Test
 * 
 * Ponytail: one test file covering the critical authorization paths.
 * Tests that role-based access control works as documented in §7.
 * 
 * This is the "one small test" for non-trivial logic.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const localEnvPath = resolve(__dirname, '../../../.env.local');
if (existsSync(localEnvPath)) {
  for (const line of readFileSync(localEnvPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^"|"$/g, '');
  }
}

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { prisma } from '@vhp/database';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';

describe('Authorization Matrix (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let brokerToken: string;
  let assistantToken: string;
  let auditorToken: string;
  let tenantToken: string;
  let testOrgId: string;
  let testClientId: string;
  let uploadedDocumentId: string | undefined;
  const testRunId = Date.now().toString(36);

  // Helper to create JWT for a user
  const makeToken = (userId: string, orgId: string, role: string) => {
    return jwt.sign(
      { sub: userId, orgId, role, mfaVerified: true },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' },
    );
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'abcdefghijklmnopqrstuvwxyz1234567890abcdef';
    process.env.JWT_EXPIRES_IN = '1h';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api', {
      exclude: ['health', 'health/ready', 'health/live'],
    });
    await app.init();

    // Create test organization
    const org = await prisma.organization.create({
      data: { name: 'Test Org', slug: `test-org-auth-matrix-${testRunId}`, type: 'BROKER' },
    });
    testOrgId = org.id;

    const passwordHash = await argon2.hash('test123');

    // Create users with different roles
    const admin = await prisma.user.create({
      data: { orgId: testOrgId, email: `admin-${testRunId}@test.local`, name: 'Admin', passwordHash, role: 'ADMIN', status: 'ACTIVE', mfaEnrolled: true, mfaSecret: 'TESTSECRET' },
    });
    const broker = await prisma.user.create({
      data: { orgId: testOrgId, email: `broker-${testRunId}@test.local`, name: 'Broker', passwordHash, role: 'BROKER', status: 'ACTIVE', mfaEnrolled: true, mfaSecret: 'TESTSECRET' },
    });
    const assistant = await prisma.user.create({
      data: { orgId: testOrgId, email: `assistant-${testRunId}@test.local`, name: 'Assistant', passwordHash, role: 'ASSISTANT', status: 'ACTIVE', mfaEnrolled: true, mfaSecret: 'TESTSECRET' },
    });
    const auditor = await prisma.user.create({
      data: { orgId: testOrgId, email: `auditor-${testRunId}@test.local`, name: 'Auditor', passwordHash, role: 'AUDITOR', status: 'ACTIVE', mfaEnrolled: true, mfaSecret: 'TESTSECRET' },
    });
    const tenant = await prisma.user.create({
      data: { orgId: testOrgId, email: `tenant-${testRunId}@test.local`, name: 'Tenant', passwordHash, role: 'TENANT', status: 'ACTIVE' },
    });

    adminToken = makeToken(admin.id, testOrgId, 'ADMIN');
    brokerToken = makeToken(broker.id, testOrgId, 'BROKER');
    assistantToken = makeToken(assistant.id, testOrgId, 'ASSISTANT');
    auditorToken = makeToken(auditor.id, testOrgId, 'AUDITOR');
    tenantToken = makeToken(tenant.id, testOrgId, 'TENANT');

    // Create a test client
    const client = await prisma.client.create({
      data: { orgId: testOrgId, legalName: 'Test Client', pipelineStage: 'NEW_LEAD' },
    });
    testClientId = client.id;
  });

  afterAll(async () => {
    // Cleanup
    if (testOrgId) {
      if (uploadedDocumentId) {
        await prisma.documentEvent.deleteMany({ where: { documentId: uploadedDocumentId } });
        await prisma.document.delete({ where: { id: uploadedDocumentId } });
      }
      await prisma.client.deleteMany({ where: { orgId: testOrgId } });
      await prisma.auditLog.deleteMany({ where: { orgId: testOrgId } });
      await prisma.user.deleteMany({ where: { orgId: testOrgId } });
      await prisma.organization.deleteMany({ where: { id: testOrgId } });
    }
    if (app) await app.close();
  });

  // =========================================================================
  // Client endpoints - role matrix
  // =========================================================================

  describe('GET /api/clients', () => {
    it('ADMIN can list clients', () => {
      return request(app.getHttpServer())
        .get('/api/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);
    });

    it('BROKER can list clients', () => {
      return request(app.getHttpServer())
        .get('/api/clients')
        .set('Authorization', `Bearer ${brokerToken}`)
        .expect(HttpStatus.OK);
    });

    it('ASSISTANT can list clients', () => {
      return request(app.getHttpServer())
        .get('/api/clients')
        .set('Authorization', `Bearer ${assistantToken}`)
        .expect(HttpStatus.OK);
    });

    it('AUDITOR can list clients (read-only)', () => {
      return request(app.getHttpServer())
        .get('/api/clients')
        .set('Authorization', `Bearer ${auditorToken}`)
        .expect(HttpStatus.OK);
    });

    it('TENANT cannot list clients', () => {
      return request(app.getHttpServer())
        .get('/api/clients')
        .set('Authorization', `Bearer ${tenantToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('Unauthenticated request is rejected', () => {
      return request(app.getHttpServer())
        .get('/api/clients')
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('POST /api/clients', () => {
    it('ADMIN can create clients', () => {
      return request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ legalName: 'New Client Admin' })
        .expect(HttpStatus.CREATED);
    });

    it('BROKER can create clients', () => {
      return request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', `Bearer ${brokerToken}`)
        .send({ legalName: 'New Client Broker' })
        .expect(HttpStatus.CREATED);
    });

    it('ASSISTANT can create clients', () => {
      return request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', `Bearer ${assistantToken}`)
        .send({ legalName: 'New Client Assistant' })
        .expect(HttpStatus.CREATED);
    });

    it('AUDITOR cannot create clients (read-only)', () => {
      return request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', `Bearer ${auditorToken}`)
        .send({ legalName: 'New Client Auditor' })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('TENANT cannot create clients', () => {
      return request(app.getHttpServer())
        .post('/api/clients')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ legalName: 'New Client Tenant' })
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  describe('POST /api/documents/upload', () => {
    it('stores a valid PDF in quarantine and registers metadata', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('clientId', testClientId)
        .attach('file', Buffer.from('%PDF-authorization-test'), {
          filename: 'authorization-test.pdf',
          contentType: 'application/pdf',
        })
        .expect(HttpStatus.CREATED);

      uploadedDocumentId = response.body.id;
      expect(response.body.mimeType).toBe('application/pdf');
      expect(response.body.storageStatus).toBe('STORED_QUARANTINED');
      expect(response.body.sha256).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('DELETE /api/clients/:id', () => {
    it('ADMIN can delete clients', async () => {
      const client = await prisma.client.create({
        data: { orgId: testOrgId, legalName: 'To Delete Admin', pipelineStage: 'NEW_LEAD' },
      });
      return request(app.getHttpServer())
        .delete(`/api/clients/${client.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);
    });

    it('BROKER can delete clients', async () => {
      const client = await prisma.client.create({
        data: { orgId: testOrgId, legalName: 'To Delete Broker', pipelineStage: 'NEW_LEAD' },
      });
      return request(app.getHttpServer())
        .delete(`/api/clients/${client.id}`)
        .set('Authorization', `Bearer ${brokerToken}`)
        .expect(HttpStatus.OK);
    });

    it('ASSISTANT cannot delete clients', async () => {
      const client = await prisma.client.create({
        data: { orgId: testOrgId, legalName: 'To Delete Assistant', pipelineStage: 'NEW_LEAD' },
      });
      return request(app.getHttpServer())
        .delete(`/api/clients/${client.id}`)
        .set('Authorization', `Bearer ${assistantToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('AUDITOR cannot delete clients', () => {
      return request(app.getHttpServer())
        .delete(`/api/clients/${testClientId}`)
        .set('Authorization', `Bearer ${auditorToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });

  // =========================================================================
  // Org isolation - critical security test
  // =========================================================================

  describe('Organization Isolation', () => {
    it('User cannot access clients from another org', async () => {
      // Create another org with a client
      const otherOrg = await prisma.organization.create({
        data: { name: 'Other Org', slug: `other-org-isolation-${testRunId}`, type: 'BROKER' },
      });
      const otherClient = await prisma.client.create({
        data: { orgId: otherOrg.id, legalName: 'Other Org Client', pipelineStage: 'NEW_LEAD' },
      });

      // Try to access with our admin token (different org)
      const res = await request(app.getHttpServer())
        .get(`/api/clients/${otherClient.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NOT_FOUND);

      // Cleanup
      await prisma.client.delete({ where: { id: otherClient.id } });
      await prisma.organization.delete({ where: { id: otherOrg.id } });
    });
  });
});
