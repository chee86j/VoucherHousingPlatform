import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma, UserRole, Prisma } from '@vhp/database';
import { CreateCaseDto, EvaluateDto, TransitionDto } from './workflow.dto';
import { decideFit, FIT_RULE_VERSION, nextStage } from './workflow.rules';

type Actor = { id: string; orgId: string; role: UserRole };
const verified = (v: { status: string; verificationState: string; expiryDate: Date | null } | null, now: Date) =>
  !!v && v.status === 'ACTIVE' && ['DOC_VERIFIED', 'AGENCY_CONFIRMED'].includes(v.verificationState) && (!v.expiryDate || v.expiryDate > now);
const sameInputs = (snapshot: Prisma.JsonValue, current: Record<string, unknown>) => {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false;
  const stored = snapshot as Record<string, unknown>;
  return Object.keys(current).every(k => {
    const canonical = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value)
      ? JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : JSON.stringify(value);
    return canonical(stored[k]) === canonical(current[k]);
  });
};

@Injectable()
export class WorkflowService {
  async list(actor: Actor) {
    return prisma.case.findMany({ where: { orgId: actor.orgId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 100 });
  }
  async get(id: string, actor: Actor) {
    const record = await prisma.case.findFirst({ where: { id, orgId: actor.orgId }, include: { history: { orderBy: { occurredAt: 'asc' } }, checklist: true, fitEvaluations: { orderBy: { computedAt: 'desc' }, take: 20 } } });
    if (!record) throw new NotFoundException('Case not found');
    return record;
  }
  async create(actor: Actor, dto: CreateCaseDto) {
    const [client, owner] = await Promise.all([
      prisma.client.findFirst({ where: { id: dto.clientId, orgId: actor.orgId } }),
      prisma.user.findFirst({ where: { id: dto.ownerUserId, orgId: actor.orgId, status: 'ACTIVE', role: { in: ['ADMIN', 'BROKER', 'ASSISTANT'] } } }),
    ]);
    if (!client || !owner) throw new BadRequestException('Client or active staff owner not found in organization');
    return prisma.case.create({ data: { orgId: actor.orgId, clientId: client.id, ownerUserId: owner.id } });
  }
  async evaluate(id: string, actor: Actor, dto: EvaluateDto) {
    const record = await this.get(id, actor);
    const [voucher, unit] = await Promise.all([
      prisma.voucher.findFirst({ where: { id: dto.voucherId, clientId: record.clientId } }),
      prisma.unit.findFirst({ where: { id: dto.unitId, property: { landlord: { orgId: actor.orgId } } } }),
    ]);
    if (!voucher || !unit) throw new NotFoundException('Voucher or unit not found');
    const decision = decideFit({ bedroomsApproved: voucher.bedroomsApproved, maxRentCents: voucher.maxRentCents, utilityResponsibility: voucher.utilityResponsibility, bedrooms: unit.bedrooms, askingRentCents: unit.askingRentCents, utilitiesIncluded: unit.utilitiesIncluded });
    if (!verified(voucher, new Date()) || unit.status !== 'AVAILABLE') {
      decision.result = 'NEEDS_REVIEW'; decision.reasons.push('Voucher not currently verified/active or unit not available');
    }
    // Store only objective economic inputs, never program type, names or protected traits.
    return prisma.fitEvaluation.create({ data: { caseId: id, unitId: unit.id, voucherId: voucher.id, result: decision.result, reasons: decision.reasons, ruleVersion: FIT_RULE_VERSION, snapshot: { bedroomsApproved: voucher.bedroomsApproved, maxRentCents: voucher.maxRentCents, utilityResponsibility: voucher.utilityResponsibility, bedrooms: unit.bedrooms, askingRentCents: unit.askingRentCents, utilitiesIncluded: unit.utilitiesIncluded }, computedBy: actor.id } });
  }
  async transition(id: string, actor: Actor, dto: TransitionDto) {
    return this.move(id, actor, dto.action, dto.reason, dto.voucherId, dto.unitId);
  }
  private async move(id: string, actor: Actor, action: string, reason?: string, voucherId?: string, unitId?: string) {
    return prisma.$transaction(async tx => {
      const record = await tx.case.findFirst({ where: { id, orgId: actor.orgId }, include: { client: { include: { householdMembers: { where: { removedAt: null } } } }, checklist: true } });
      if (!record) throw new NotFoundException('Case not found');
      const to = nextStage(record.stage, action);
      if (['withdraw', 'voucher_invalid', 'unit_lost'].includes(action) && !reason?.trim()) throw new BadRequestException('Reason required');
      const now = new Date();
      let chosenVoucher: string | undefined;
      let chosenUnit: string | undefined;
      {
        if (action === 'intake_completed' && !(record.client.phone || record.client.email) || action === 'intake_completed' && !record.client.householdMembers.length) throw new BadRequestException('Contact and household size required');
        if (action === 'voucher_submitted' && !(await tx.voucher.count({ where: { clientId: record.clientId } }))) throw new BadRequestException('Voucher required');
        if (action === 'voucher_verified' || action === 'readiness_reached') {
          const voucher = await tx.voucher.findFirst({ where: { clientId: record.clientId, ...(voucherId ? { id: voucherId } : {}), status: 'ACTIVE', verificationState: { in: ['DOC_VERIFIED', 'AGENCY_CONFIRMED'] } }, orderBy: { createdAt: 'desc' } });
          if (!verified(voucher, now) || !voucher?.utilityResponsibility) throw new BadRequestException('Verified unexpired voucher with utility split required');
          chosenVoucher = voucher.id;
          if (action === 'readiness_reached' && (!record.checklist.length || record.checklist.some(item => item.state !== 'VERIFIED' || item.expiresAt && item.expiresAt <= now))) throw new BadRequestException('Verified, unexpired blocking checklist required');
        }
        if (action === 'unit_matched') {
          if (!unitId || !voucherId) throw new BadRequestException('Unit and voucher required');
          const [unit, voucher, fit] = await Promise.all([
            tx.unit.findFirst({ where: { id: unitId, status: 'AVAILABLE', property: { landlord: { orgId: actor.orgId } } } }),
            tx.voucher.findFirst({ where: { id: voucherId, clientId: record.clientId } }),
            tx.fitEvaluation.findFirst({ where: { caseId: id, unitId, voucherId }, orderBy: [{ computedAt: 'desc' }, { id: 'desc' }] }),
          ]);
          const inputs = { bedroomsApproved: voucher?.bedroomsApproved, maxRentCents: voucher?.maxRentCents, utilityResponsibility: voucher?.utilityResponsibility, bedrooms: unit?.bedrooms, askingRentCents: unit?.askingRentCents, utilitiesIncluded: unit?.utilitiesIncluded };
          if (!unit || !voucher || !verified(voucher, now) || fit?.result !== 'ELIGIBLE' || fit.ruleVersion !== FIT_RULE_VERSION || !sameInputs(fit.snapshot, inputs) || decideFit(inputs as Parameters<typeof decideFit>[0]).result !== 'ELIGIBLE') throw new BadRequestException('Current eligible fit, verified voucher and available unit required');
          chosenUnit = unitId; chosenVoucher = voucherId;
        }
      }
      const changed = await tx.case.updateMany({ where: { id, orgId: actor.orgId, stage: record.stage, stageEnteredAt: record.stageEnteredAt }, data: { stage: to, stageEnteredAt: now, stalled: false, ...(chosenVoucher && { voucherId: chosenVoucher }), ...(chosenUnit && { unitId: chosenUnit }), ...(action === 'unit_lost' && { unitId: null }) } });
      if (!changed.count) throw new ConflictException('Case changed concurrently');
      await tx.caseStageHistory.create({ data: { caseId: id, fromStage: record.stage, toStage: to, action, actorUserId: actor.id, fromOwnerId: record.ownerUserId, toOwnerId: record.ownerUserId, reason: reason?.trim(), override: false, occurredAt: now, durationInPrevStageSeconds: Math.max(0, Math.floor((now.getTime() - record.stageEnteredAt.getTime()) / 1000)) } });
      return tx.case.findUniqueOrThrow({ where: { id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
