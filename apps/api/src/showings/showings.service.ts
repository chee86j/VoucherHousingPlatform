import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, Prisma, ParticipantStatus, UserRole } from '@vhp/database';
import { CreateShowingDto, CreateTaskDto } from './showings.dto';

type Actor = { id: string; orgId: string; role: UserRole };
const staff = ['ADMIN', 'BROKER', 'ASSISTANT'] as UserRole[];
export function assertStatusChange(from: ParticipantStatus, to: ParticipantStatus, startsAt: Date, endsAt: Date, now = new Date()) {
  const allowed: Record<ParticipantStatus, ParticipantStatus[]> = {
    INVITED: ['CONFIRMED', 'DECLINED'], CONFIRMED: ['DECLINED', 'ATTENDED', 'NO_SHOW'],
    DECLINED: [], ATTENDED: [], NO_SHOW: [],
  };
  if (!allowed[from].includes(to)) throw new ConflictException('Invalid participant transition');
  if (['CONFIRMED', 'DECLINED'].includes(to) && now >= startsAt) throw new ConflictException('Response window closed');
  if (to === 'ATTENDED' && now < startsAt || to === 'NO_SHOW' && now < endsAt) throw new ConflictException('Attendance window not reached');
}

@Injectable()
export class ShowingsService {
  list(actor: Actor) { return prisma.showingSession.findMany({ where: { orgId: actor.orgId }, orderBy: [{ startsAt: 'asc' }, { id: 'asc' }], take: 100, include: { participants: true } }); }
  async get(id: string, actor: Actor) {
    const session = await prisma.showingSession.findFirst({ where: { id, orgId: actor.orgId }, include: { participants: true, events: { orderBy: { occurredAt: 'asc' } } } });
    if (!session) throw new NotFoundException('Showing not found');
    return session;
  }
  async create(actor: Actor, dto: CreateShowingDto) {
    const start = new Date(dto.startsAt), end = new Date(dto.endsAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start <= new Date() || end <= start) throw new BadRequestException('Future start and later end required');
    if (!Array.isArray(dto.clientIds) || !dto.clientIds.length || dto.clientIds.length > 50 || dto.clientIds.some(id => !id?.trim()) || new Set(dto.clientIds).size !== dto.clientIds.length) throw new BadRequestException('Between 1 and 50 unique client IDs required');
    return prisma.$transaction(async tx => {
      const [unit, clients] = await Promise.all([
        tx.unit.findFirst({ where: { id: dto.unitId, status: 'AVAILABLE', property: { landlord: { orgId: actor.orgId } } } }),
        tx.client.findMany({ where: { id: { in: dto.clientIds }, orgId: actor.orgId }, select: { id: true } }),
      ]);
      if (!unit || clients.length !== dto.clientIds.length) throw new NotFoundException('Available unit or clients not found in organization');
      // Per-unit advisory lock serializes concurrent schedule requests (including different time ranges).
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${dto.unitId}))`;
      if (await tx.showingSession.count({ where: { unitId: dto.unitId, status: 'SCHEDULED', startsAt: { lt: end }, endsAt: { gt: start } } })) throw new ConflictException('Unit has overlapping showing');
      const session = await tx.showingSession.create({ data: { orgId: actor.orgId, unitId: dto.unitId, startsAt: start, endsAt: end, participants: { create: dto.clientIds.map(clientId => ({ clientId })) } }, include: { participants: true } });
      await tx.showingEvent.create({ data: { sessionId: session.id, actorUserId: actor.id, action: 'CREATED', toStatus: 'SCHEDULED' } });
      await tx.showingEvent.createMany({ data: dto.clientIds.map(clientId => ({ sessionId: session.id, actorUserId: actor.id, clientId, action: 'INVITED', toStatus: 'INVITED' })) });
      return session;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async invite(id: string, clientId: string, actor: Actor) {
    return prisma.$transaction(async tx => {
      const session = await tx.showingSession.findFirst({ where: { id, orgId: actor.orgId, status: 'SCHEDULED' } });
      if (!session) throw new NotFoundException('Scheduled showing not found');
      if (session.startsAt <= new Date()) throw new ConflictException('Showing already started');
      if (!await tx.client.findFirst({ where: { id: clientId, orgId: actor.orgId } })) throw new NotFoundException('Client not found');
      if (await tx.showingParticipant.findUnique({ where: { sessionId_clientId: { sessionId: id, clientId } } })) throw new ConflictException('Client already invited');
      const participant = await tx.showingParticipant.create({ data: { sessionId: id, clientId } });
      await tx.showingEvent.create({ data: { sessionId: id, actorUserId: actor.id, clientId, action: 'INVITED', toStatus: 'INVITED' } });
      return participant;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async status(id: string, clientId: string, status: ParticipantStatus, actor: Actor) {
    return prisma.$transaction(async tx => {
      const session = await tx.showingSession.findFirst({ where: { id, orgId: actor.orgId } });
      if (!session) throw new NotFoundException('Showing not found');
      if (session.status !== 'SCHEDULED') throw new ConflictException('Showing cancelled');
      const participant = await tx.showingParticipant.findUnique({ where: { sessionId_clientId: { sessionId: id, clientId } } });
      if (!participant) throw new NotFoundException('Participant not found');
      assertStatusChange(participant.status, status, session.startsAt, session.endsAt);
      const changed = await tx.showingParticipant.updateMany({ where: { id: participant.id, status: participant.status }, data: { status } });
      if (!changed.count) throw new ConflictException('Participant changed concurrently');
      await tx.showingEvent.create({ data: { sessionId: id, actorUserId: actor.id, clientId, action: 'PARTICIPANT_STATUS', fromStatus: participant.status, toStatus: status } });
      return tx.showingParticipant.findUniqueOrThrow({ where: { id: participant.id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async cancel(id: string, actor: Actor) {
    return prisma.$transaction(async tx => {
      const session = await tx.showingSession.findFirst({ where: { id, orgId: actor.orgId } });
      if (!session) throw new NotFoundException('Showing not found');
      if (session.status !== 'SCHEDULED' || session.startsAt <= new Date()) throw new ConflictException('Only future scheduled showings can be cancelled');
      const changed = await tx.showingSession.updateMany({ where: { id, orgId: actor.orgId, status: 'SCHEDULED' }, data: { status: 'CANCELLED' } });
      if (!changed.count) throw new ConflictException('Showing changed concurrently');
      await tx.showingEvent.create({ data: { sessionId: id, actorUserId: actor.id, action: 'CANCELLED', fromStatus: 'SCHEDULED', toStatus: 'CANCELLED' } });
      return tx.showingSession.findUniqueOrThrow({ where: { id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  tasks(actor: Actor) { return prisma.followUpTask.findMany({ where: { orgId: actor.orgId }, orderBy: [{ dueAt: 'asc' }, { id: 'asc' }], take: 100 }); }
  async createTask(actor: Actor, dto: CreateTaskDto) {
    const due = new Date(dto.dueAt);
    if (!Number.isFinite(due.getTime()) || due <= new Date() || !dto.title?.trim()) throw new BadRequestException('Future due date and title required');
    return prisma.$transaction(async tx => {
      const [owner, session, record] = await Promise.all([
        tx.user.findFirst({ where: { id: dto.ownerUserId, orgId: actor.orgId, status: 'ACTIVE', role: { in: staff } } }),
        dto.sessionId ? tx.showingSession.findFirst({ where: { id: dto.sessionId, orgId: actor.orgId } }) : Promise.resolve(null),
        dto.caseId ? tx.case.findFirst({ where: { id: dto.caseId, orgId: actor.orgId } }) : Promise.resolve(null),
      ]);
      if (!owner || dto.sessionId && !session || dto.caseId && !record) throw new NotFoundException('Owner, showing or case not found in organization');
      if (session && record && !await tx.showingParticipant.findUnique({ where: { sessionId_clientId: { sessionId: session.id, clientId: record.clientId } } })) throw new BadRequestException('Case client is not a showing participant');
      const task = await tx.followUpTask.create({ data: { orgId: actor.orgId, ownerUserId: owner.id, createdById: actor.id, title: dto.title.trim(), dueAt: due, sessionId: dto.sessionId, caseId: dto.caseId } });
      await tx.showingEvent.create({ data: { taskId: task.id, actorUserId: actor.id, action: 'TASK_CREATED', toStatus: 'OPEN' } });
      return task;
    });
  }
  async completeTask(id: string, actor: Actor) {
    return prisma.$transaction(async tx => {
      const task = await tx.followUpTask.findFirst({ where: { id, orgId: actor.orgId } });
      if (!task) throw new NotFoundException('Task not found');
      if (actor.role === 'ASSISTANT' && task.ownerUserId !== actor.id) throw new ForbiddenException('Only the task owner may complete this task');
      if (task.status !== 'OPEN') throw new ConflictException('Task already completed');
      const changed = await tx.followUpTask.updateMany({ where: { id, orgId: actor.orgId, status: 'OPEN' }, data: { status: 'COMPLETED', completedAt: new Date() } });
      if (!changed.count) throw new ConflictException('Task changed concurrently');
      await tx.showingEvent.create({ data: { taskId: id, actorUserId: actor.id, action: 'TASK_COMPLETED', fromStatus: 'OPEN', toStatus: 'COMPLETED' } });
      return tx.followUpTask.findUniqueOrThrow({ where: { id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
