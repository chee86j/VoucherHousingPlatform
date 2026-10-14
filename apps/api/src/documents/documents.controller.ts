import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@vhp/database';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DocumentsService, DocumentActor } from './documents.service';
import { RegisterDocumentDto, ReviewDocumentDto } from './documents.dto';

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

  @Post()
  @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT)
  register(@CurrentUser() actor: DocumentActor, @Body() dto: RegisterDocumentDto) { return this.service.register(actor, dto); }

  @Post(':id/review')
  @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT)
  review(@CurrentUser() actor: DocumentActor, @Param('id') id: string, @Body() dto: ReviewDocumentDto) { return this.service.review(actor, id, dto); }
}
