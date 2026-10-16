import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentStorageService, DOCUMENT_STORAGE, LocalPrivateDocumentStorage } from './document-storage.service';

@Module({
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    DocumentStorageService,
    { provide: DOCUMENT_STORAGE, useFactory: () => new LocalPrivateDocumentStorage() },
  ],
})
export class DocumentsModule {}
