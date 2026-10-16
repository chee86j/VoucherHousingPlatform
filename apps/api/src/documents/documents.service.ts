import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ChecklistState, DocumentStatus, DocumentStorageStatus, prisma, Prisma } from '@vhp/database';
import { RegisterDocumentDto, ReviewDocumentDto } from './documents.dto';
import { DocumentStorageService } from './document-storage.service';

export type DocumentActor = { id: string; orgId: string };
export type RegisterDocumentInput = RegisterDocumentDto & { storageKey?: string };
const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const maxBytes = 15 * 1024 * 1024;

export function normalizeDocumentFileName(fileName: string): string {
  const normalized = fileName.normalize('NFKC').trim();
  const hasUnsafeCharacter = Array.from(normalized).some((character) => {
    const code = character.codePointAt(0) || 0;
    return code < 0x20 || code === 0x7f || character === '\\' || character === '/' || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069);
  });
  if (!normalized || normalized.length > 180 || hasUnsafeCharacter) {
    throw new BadRequestException('File name contains invalid characters');
  }
  return normalized;
}

export function validateDocumentMetadata(dto: Pick<RegisterDocumentDto, 'fileName' | 'mimeType' | 'sizeBytes' | 'sha256'>) {
  normalizeDocumentFileName(dto.fileName);
  if (!allowedMimeTypes.has(dto.mimeType)) throw new BadRequestException('Only PDF, JPEG and PNG documents are accepted');
  if (!Number.isInteger(dto.sizeBytes) || dto.sizeBytes < 1 || dto.sizeBytes > maxBytes) throw new BadRequestException('Document must be between 1 byte and 15 MB');
  if (!/^[a-f0-9]{64}$/i.test(dto.sha256)) throw new BadRequestException('sha256 must be a 64 character hex digest');
}

export function checklistStateForReview(status: DocumentStatus): ChecklistState {
  if (status === 'VERIFIED') return 'VERIFIED';
  if (status === 'REJECTED') return 'REJECTED';
  throw new BadRequestException('Review status must be VERIFIED or REJECTED');
}

@Injectable()
export class DocumentsService {
  constructor(private readonly storage: DocumentStorageService) {}

  list(actor: DocumentActor) {
    return prisma.document.findMany({
      where: { orgId: actor.orgId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 100,
      select: documentSelect,
    });
  }

  async get(actor: DocumentActor, id: string) {
    const doc = await prisma.document.findFirst({ where: { id, orgId: actor.orgId }, select: { ...documentSelect, events: { orderBy: { occurredAt: 'asc' } } } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async upload(actor: DocumentActor, file: Express.Multer.File, metadata: Omit<Pick<RegisterDocumentDto, 'clientId' | 'caseId' | 'checklistItemId' | 'fileName'>, 'fileName'> & { fileName?: string }) {
    if (!file) throw new BadRequestException('A document file is required');
    if (file.size < 1 || file.size > maxBytes) throw new BadRequestException('Document must be between 1 byte and 15 MB');
    if (!allowedMimeTypes.has(file.mimetype)) throw new BadRequestException('Only PDF, JPEG and PNG documents are accepted');
    const fileName = normalizeDocumentFileName(metadata.fileName || file.originalname);

    let stored: Awaited<ReturnType<DocumentStorageService['quarantine']>>;
    try {
      stored = await this.storage.quarantine(actor.orgId, file);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Document could not be stored');
    }

    try {
      return await this.register(actor, {
        ...metadata,
        fileName,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        sha256: stored.sha256,
        storageKey: stored.storageKey,
      });
    } catch (error) {
      try {
        await this.storage.remove(stored.storageKey);
      } catch {
        // Preserve the registration error; reconciliation will handle orphan cleanup.
      }
      throw error;
    }
  }

  async register(actor: DocumentActor, dto: RegisterDocumentInput) {
    validateDocumentMetadata(dto);
    return prisma.$transaction(async tx => {
      const [client, record, checklist] = await Promise.all([
        tx.client.findFirst({ where: { id: dto.clientId, orgId: actor.orgId }, select: { id: true } }),
        dto.caseId ? tx.case.findFirst({ where: { id: dto.caseId, orgId: actor.orgId, clientId: dto.clientId }, select: { id: true } }) : Promise.resolve(null),
        dto.checklistItemId ? tx.checklistItem.findFirst({ where: { id: dto.checklistItemId, case: { orgId: actor.orgId, clientId: dto.clientId, id: dto.caseId } }, select: { id: true, state: true } }) : Promise.resolve(null),
      ]);
      if (!client || dto.caseId && !record || dto.checklistItemId && !checklist) throw new NotFoundException('Client, case or checklist item not found in organization');
      if (await tx.document.findUnique({ where: { orgId_sha256: { orgId: actor.orgId, sha256: dto.sha256.toLowerCase() } } })) throw new ConflictException('Document digest already registered in this organization');
      const doc = await tx.document.create({
        data: {
          orgId: actor.orgId,
          clientId: dto.clientId,
          caseId: dto.caseId,
          checklistItemId: dto.checklistItemId,
          uploadedById: actor.id,
          fileName: dto.fileName.trim(),
          mimeType: dto.mimeType,
          sizeBytes: dto.sizeBytes,
          sha256: dto.sha256.toLowerCase(),
          storageKey: dto.storageKey,
          storageStatus: dto.storageKey ? DocumentStorageStatus.STORED_QUARANTINED : DocumentStorageStatus.METADATA_ONLY,
        },
        select: documentSelect,
      });
      if (dto.checklistItemId && checklist?.state === 'MISSING') await tx.checklistItem.update({ where: { id: dto.checklistItemId }, data: { state: 'UPLOADED' } });
      await tx.documentEvent.create({ data: { documentId: doc.id, actorUserId: actor.id, action: 'REGISTERED', toStatus: 'UPLOADED' } });
      return doc;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async review(actor: DocumentActor, id: string, dto: ReviewDocumentDto) {
    const nextChecklistState = checklistStateForReview(dto.status);
    return prisma.$transaction(async tx => {
      const doc = await tx.document.findFirst({ where: { id, orgId: actor.orgId } });
      if (!doc) throw new NotFoundException('Document not found');
      if (!['UPLOADED', 'UNDER_REVIEW'].includes(doc.status)) throw new ConflictException('Document already reviewed');
      if (dto.status === 'REJECTED' && !dto.note?.trim()) throw new BadRequestException('Rejection note is required');
      const changed = await tx.document.updateMany({ where: { id, orgId: actor.orgId, status: doc.status }, data: { status: dto.status, reviewNote: dto.note?.trim(), reviewedById: actor.id, reviewedAt: new Date() } });
      if (!changed.count) throw new ConflictException('Document changed concurrently');
      if (doc.checklistItemId) await tx.checklistItem.update({ where: { id: doc.checklistItemId }, data: { state: nextChecklistState } });
      await tx.documentEvent.create({ data: { documentId: id, actorUserId: actor.id, action: 'REVIEWED', fromStatus: doc.status, toStatus: dto.status, note: dto.note?.trim() } });
      return tx.document.findUniqueOrThrow({ where: { id }, select: documentSelect });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

const documentSelect = {
  id: true,
  clientId: true,
  caseId: true,
  checklistItemId: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  sha256: true,
  storageStatus: true,
  status: true,
  visibility: true,
  reviewNote: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;
