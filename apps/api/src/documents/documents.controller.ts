import { Body, Controller, Get, Header, Param, Post, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@vhp/database';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditAction } from '../common/decorators/audit.decorator';
import { DocumentsService, DocumentActor } from './documents.service';
import { DocumentIdParamDto, RegisterDocumentDto, ReviewDocumentDto } from './documents.dto';
import { UploadDocumentBodyDto } from './upload.dto';

@Controller('documents')
@UseGuards(AuthGuard, RolesGuard)
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT, UserRole.AUDITOR)
  list(@CurrentUser() actor: DocumentActor) { return this.service.list(actor); }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT, UserRole.AUDITOR)
  get(@CurrentUser() actor: DocumentActor, @Param('id') id: string) { return this.service.get(actor, id); }

  @Get(':id/content')
  @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT, UserRole.AUDITOR)
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @AuditAction('DOCUMENT_DOWNLOADED')
  @Header('Cache-Control', 'private, no-store, max-age=0')
  async download(@CurrentUser() actor: DocumentActor, @Param() params: DocumentIdParamDto) {
    const document = await this.service.download(actor, params.id);
    return new StreamableFile(document.bytes, {
      type: document.mimeType,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
    });
  }

  @Post('upload')
  @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT)
  @UseInterceptors(FileInterceptor('file', {
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 15 * 1024 * 1024,
      files: 1,
      fields: 4,
      fieldSize: 64 * 1024,
      parts: 6,
      headerPairs: 200,
    },
  }))
  upload(@CurrentUser() actor: DocumentActor, @UploadedFile() file: Express.Multer.File, @Body() body: UploadDocumentBodyDto) {
    return this.service.upload(actor, file, body);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT)
  register(@CurrentUser() actor: DocumentActor, @Body() dto: RegisterDocumentDto) { return this.service.register(actor, dto); }

  @Post(':id/review')
  @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT)
  review(@CurrentUser() actor: DocumentActor, @Param('id') id: string, @Body() dto: ReviewDocumentDto) { return this.service.review(actor, id, dto); }
}
