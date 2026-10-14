import { BadRequestException } from '@nestjs/common';
import { checklistStateForReview, validateDocumentMetadata } from './documents.service';

describe('document metadata policy', () => {
  const base = { fileName: 'voucher.pdf', mimeType: 'application/pdf', sizeBytes: 1024, sha256: 'a'.repeat(64) };

  it('accepts supported document metadata', () => {
    expect(() => validateDocumentMetadata(base)).not.toThrow();
  });

  it('rejects unsupported executable-like content types', () => {
    expect(() => validateDocumentMetadata({ ...base, mimeType: 'text/html' })).toThrow(BadRequestException);
  });

  it('rejects oversized documents', () => {
    expect(() => validateDocumentMetadata({ ...base, sizeBytes: 15 * 1024 * 1024 + 1 })).toThrow(BadRequestException);
  });

  it('requires a real sha256 digest', () => {
    expect(() => validateDocumentMetadata({ ...base, sha256: 'not-a-digest' })).toThrow(BadRequestException);
  });

  it('maps final review statuses to checklist states only', () => {
    expect(checklistStateForReview('VERIFIED')).toBe('VERIFIED');
    expect(checklistStateForReview('REJECTED')).toBe('REJECTED');
    expect(() => checklistStateForReview('UPLOADED')).toThrow(BadRequestException);
  });
});
