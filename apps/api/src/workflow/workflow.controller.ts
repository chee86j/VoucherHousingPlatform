import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@vhp/database';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditAction } from '../common/decorators/audit.decorator';
import { WorkflowService } from './workflow.service';
import { CreateCaseDto, EvaluateDto, TransitionDto } from './workflow.dto';

type Actor = { id: string; orgId: string; role: UserRole };
@Controller('cases')
@UseGuards(AuthGuard, RolesGuard)
export class WorkflowController {
  constructor(private readonly service: WorkflowService) {}
  @Get()
  @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT)
  list(@CurrentUser() actor: Actor) { return this.service.list(actor); }
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.BROKER, UserRole.ASSISTANT)
  get(@CurrentUser() actor: Actor, @Param('id') id: string): Promise<unknown> { return this.service.get(id, actor); }
  @Post()
  @Roles(UserRole.ADMIN, UserRole.BROKER)
  create(@CurrentUser() actor: Actor, @Body() dto: CreateCaseDto) { return this.service.create(actor, dto); }
  @Post(':id/evaluations')
  @Roles(UserRole.ADMIN, UserRole.BROKER)
  evaluate(@CurrentUser() actor: Actor, @Param('id') id: string, @Body() dto: EvaluateDto): Promise<unknown> { return this.service.evaluate(id, actor, dto); }
  @Post(':id/transitions')
  @Roles(UserRole.ADMIN, UserRole.BROKER)
  @AuditAction('STAGE_TRANSITION')
  transition(@CurrentUser() actor: Actor, @Param('id') id: string, @Body() dto: TransitionDto) { return this.service.transition(id, actor, dto); }
}
