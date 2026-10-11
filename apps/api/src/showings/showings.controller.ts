import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ParticipantStatus, UserRole } from '@vhp/database';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ShowingsService } from './showings.service';
import { CreateShowingDto, CreateTaskDto, InviteDto, ParticipantStatusDto } from './showings.dto';

type Actor = { id: string; orgId: string; role: UserRole };
@Controller('showings')
@UseGuards(AuthGuard, RolesGuard)
export class ShowingsController {
  constructor(private readonly service: ShowingsService) {}
  @Get() @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT)
  list(@CurrentUser() actor: Actor) { return this.service.list(actor); }
  @Get(':id') @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT)
  get(@CurrentUser() actor: Actor, @Param('id') id: string) { return this.service.get(id, actor); }
  @Post() @Roles(UserRole.ADMIN, UserRole.BROKER)
  create(@CurrentUser() actor: Actor, @Body() dto: CreateShowingDto) { return this.service.create(actor, dto); }
  @Post(':id/participants') @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT)
  invite(@CurrentUser() actor: Actor, @Param('id') id: string, @Body() dto: InviteDto) { return this.service.invite(id, dto.clientId, actor); }
  @Patch(':id/participants/:clientId') @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT)
  status(@CurrentUser() actor: Actor, @Param('id') id: string, @Param('clientId') clientId: string, @Body() dto: ParticipantStatusDto) { return this.service.status(id, clientId, dto.status as ParticipantStatus, actor); }
  @Post(':id/cancel') @Roles(UserRole.ADMIN, UserRole.BROKER)
  cancel(@CurrentUser() actor: Actor, @Param('id') id: string) { return this.service.cancel(id, actor); }
}
@Controller('follow-up-tasks')
@UseGuards(AuthGuard, RolesGuard)
export class FollowUpTasksController {
  constructor(private readonly service: ShowingsService) {}
  @Get() @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT)
  list(@CurrentUser() actor: Actor) { return this.service.tasks(actor); }
  @Post() @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT)
  create(@CurrentUser() actor: Actor, @Body() dto: CreateTaskDto) { return this.service.createTask(actor, dto); }
  @Post(':id/complete') @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT)
  complete(@CurrentUser() actor: Actor, @Param('id') id: string) { return this.service.completeTask(id, actor); }
}
