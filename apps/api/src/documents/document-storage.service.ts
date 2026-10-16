import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { Injectable } from '@nestjs/common';
import { join, resolve } from 'path';

const signatures: Record<string, Buffer> = {
  'application/pdf': Buffer.from('%PDF-'),
  'image/jpeg': Buffer.from([0xff, 0xd8, 0xff]),
  'image/png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
};

export type QuarantinedUpload = {
  storageKey: string;
  sizeBytes: number;
  sha256: string;
  mimeType: string;
};

@Injectable()
export class DocumentStorageService {
  private readonly root = resolve(process.env.DOCUMENT_STORAGE_ROOT || '.data/documents');

  async quarantine(orgId: string, file: Express.Multer.File): Promise<QuarantinedUpload> {
    if (!/^[A-Za-z0-9_-]+$/.test(orgId)) throw new Error('Invalid organization storage scope');
    const expected = signatures[file.mimetype];
    if (!expected || !file.buffer.subarray(0, expected.length).equals(expected)) {
      throw new Error('Document content does not match its declared type');
    }

    const storageKey = `${orgId}/quarantine/${randomUUID()}`;
    const target = this.pathFor(storageKey);
    await mkdir(join(target, '..'), { recursive: true, mode: 0o700 });
    await writeFile(target, file.buffer, { mode: 0o600, flag: 'wx' });

    return {
      storageKey,
      sizeBytes: file.size,
      sha256: createHash('sha256').update(file.buffer).digest('hex'),
      mimeType: file.mimetype,
    };
  }

  async remove(storageKey: string): Promise<void> {
    await rm(this.pathFor(storageKey), { force: true });
  }

  async read(storageKey: string): Promise<Buffer> {
    return readFile(this.pathFor(storageKey));
  }

  private pathFor(storageKey: string): string {
    const root = resolve(this.root);
    const target = resolve(root, storageKey);
    if (target !== root && !target.startsWith(`${root}/`)) throw new Error('Invalid storage key');
    return target;
  }
}
