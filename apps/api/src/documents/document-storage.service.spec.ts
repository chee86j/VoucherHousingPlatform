import { mkdir, mkdtemp, readFile, rename, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { LocalPrivateDocumentStorage } from './document-storage.service';

describe('DocumentStorageService', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'vhp-documents-'));
    process.env.DOCUMENT_STORAGE_ROOT = root;
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    delete process.env.DOCUMENT_STORAGE_ROOT;
  });

  it('stores supported bytes in an organization-scoped quarantine path', async () => {
    const service = new LocalPrivateDocumentStorage();
    const file = {
      originalname: 'voucher.pdf',
      mimetype: 'application/pdf',
      size: 10,
      buffer: Buffer.from('%PDF-hello'),
    } as Express.Multer.File;

    const result = await service.quarantine('org-1', file);
    expect(result.storageKey).toMatch(/^org-1\/quarantine\//);
    expect(result.sizeBytes).toBe(10);
    expect(await readFile(join(root, result.storageKey))).toEqual(file.buffer);

    await service.remove(result.storageKey);
    await expect(readFile(join(root, result.storageKey))).rejects.toThrow();
  });

  it('rejects bytes whose magic signature does not match the declared MIME type', async () => {
    const service = new LocalPrivateDocumentStorage();
    const file = {
      originalname: 'fake.pdf',
      mimetype: 'application/pdf',
      size: 4,
      buffer: Buffer.from('MZ??'),
    } as Express.Multer.File;

    await expect(service.quarantine('org-1', file)).rejects.toThrow('does not match');
  });

  it('rejects traversal storage keys', async () => {
    const service = new LocalPrivateDocumentStorage();
    await expect(service.readAvailable('org-1', '../outside')).rejects.toThrow('available storage location');
  });

  it('never reads quarantine bytes through the available-document access method', async () => {
    const service = new LocalPrivateDocumentStorage();
    const file = { mimetype: 'application/pdf', size: 10, buffer: Buffer.from('%PDF-hello') } as Express.Multer.File;
    const result = await service.quarantine('org-1', file);
    await expect(service.readAvailable('org-1', result.storageKey)).rejects.toThrow('available storage location');

    const availableKey = result.storageKey.replace('/quarantine/', '/available/');
    await mkdir(join(root, 'org-1', 'available'), { recursive: true });
    await rename(join(root, result.storageKey), join(root, availableKey));
    await expect(service.readAvailable('org-1', availableKey)).resolves.toEqual(file.buffer);
  });
});
