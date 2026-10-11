import { prisma } from '@vhp/database';
import { ShowingsService, assertStatusChange } from './showings.service';

jest.mock('@vhp/database', () => ({ ...jest.requireActual('@vhp/database'), prisma: { $transaction: jest.fn(), showingSession: { findMany: jest.fn(), findFirst: jest.fn() }, followUpTask: { findMany: jest.fn() } } }));
const actor = { id: 'staff', orgId: 'org-a', role: 'BROKER' as const };
const service = new ShowingsService();
const db = prisma as jest.Mocked<typeof prisma>;
const future = new Date('2099-01-01T10:00:00Z');
const end = new Date('2099-01-01T11:00:00Z');
const dto = { unitId: 'unit', clientIds: ['client-a', 'client-b'], startsAt: future.toISOString(), endsAt: end.toISOString() };
const transaction = (tx: object) => (db.$transaction as jest.Mock).mockImplementation((fn: (tx: object) => Promise<unknown>) => fn(tx));

describe('showing transitions and org boundaries', () => {
  beforeEach(() => jest.clearAllMocks());
  it('enforces response and attendance windows and terminal outcomes', () => {
    expect(() => assertStatusChange('INVITED', 'ATTENDED', future, end, new Date('2098-01-01'))).toThrow();
    expect(() => assertStatusChange('INVITED', 'CONFIRMED', future, end, new Date('2098-01-01'))).not.toThrow();
    expect(() => assertStatusChange('CONFIRMED', 'NO_SHOW', future, end, future)).toThrow();
    expect(() => assertStatusChange('CONFIRMED', 'ATTENDED', future, end, future)).not.toThrow();
    expect(() => assertStatusChange('ATTENDED', 'NO_SHOW', future, end, end)).toThrow();
    expect(() => assertStatusChange('DECLINED', 'CONFIRMED', future, end, new Date('2098-01-01'))).toThrow();
  });
  it('rejects invalid time and duplicate invitations before DB writes', async () => {
    await expect(service.create(actor, { ...dto, endsAt: dto.startsAt })).rejects.toThrow();
    await expect(service.create(actor, { ...dto, clientIds: ['client-a', 'client-a'] })).rejects.toThrow();
    await expect(service.create(actor, { ...dto, clientIds: Array(51).fill('unique').map((id, i) => `${id}-${i}`) })).rejects.toThrow();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('rejects foreign-org clients and units before creating showing', async () => {
    const tx = { unit: { findFirst: jest.fn().mockResolvedValue({ id: 'unit' }) }, client: { findMany: jest.fn().mockResolvedValue([{ id: 'client-a' }]) }, showingSession: { create: jest.fn() } };
    transaction(tx);
    await expect(service.create(actor, dto)).rejects.toThrow('Available unit or clients');
    expect(tx.unit.findFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ property: { landlord: { orgId: 'org-a' } } }) });
    expect(tx.client.findMany).toHaveBeenCalledWith({ where: expect.objectContaining({ orgId: 'org-a' }), select: { id: true } });
    expect(tx.showingSession.create).not.toHaveBeenCalled();
  });
  it('blocks overlapping unit schedule after per-unit lock', async () => {
    const tx = { unit: { findFirst: jest.fn().mockResolvedValue({ id: 'unit' }) }, client: { findMany: jest.fn().mockResolvedValue([{ id: 'client-a' }, { id: 'client-b' }]) }, $queryRaw: jest.fn(), showingSession: { count: jest.fn().mockResolvedValue(1), create: jest.fn() } };
    transaction(tx);
    await expect(service.create(actor, dto)).rejects.toThrow('overlapping');
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.showingSession.count).toHaveBeenCalledWith({ where: expect.objectContaining({ status: 'SCHEDULED', startsAt: { lt: end }, endsAt: { gt: future } }) });
    expect(tx.showingSession.create).not.toHaveBeenCalled();
  });
  it('creates group and transactional history', async () => {
    const tx = { unit: { findFirst: jest.fn().mockResolvedValue({ id: 'unit' }) }, client: { findMany: jest.fn().mockResolvedValue([{ id: 'client-a' }, { id: 'client-b' }]) }, $queryRaw: jest.fn(), showingSession: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({ id: 'session' }) }, showingEvent: { create: jest.fn(), createMany: jest.fn() } };
    transaction(tx);
    await service.create(actor, dto);
    expect(tx.showingSession.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ orgId: 'org-a', participants: { create: [{ clientId: 'client-a' }, { clientId: 'client-b' }] } }) }));
    expect(tx.showingEvent.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([expect.objectContaining({ clientId: 'client-a', action: 'INVITED' })]) });
  });
  it('prevents duplicate participant and foreign-org task owner; completes once with event', async () => {
    const tx = { showingSession: { findFirst: jest.fn().mockResolvedValue({ id: 'session', startsAt: future, status: 'SCHEDULED' }) }, client: { findFirst: jest.fn().mockResolvedValue({ id: 'client-a' }) }, showingParticipant: { findUnique: jest.fn().mockResolvedValue({ id: 'p' }), create: jest.fn() }, user: { findFirst: jest.fn().mockResolvedValue(null) }, followUpTask: { findFirst: jest.fn().mockResolvedValue({ id: 'task', status: 'OPEN' }), updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'task', status: 'COMPLETED' }), create: jest.fn() }, showingEvent: { create: jest.fn() } };
    transaction(tx);
    await expect(service.invite('session', 'client-a', actor)).rejects.toThrow('already invited');
    await expect(service.createTask(actor, { title: 'Call back', dueAt: future.toISOString(), ownerUserId: 'foreign' })).rejects.toThrow('Owner');
    expect(tx.user.findFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ orgId: 'org-a', status: 'ACTIVE' }) });
    expect(tx.followUpTask.create).not.toHaveBeenCalled();
    await service.completeTask('task', actor);
    expect(tx.showingEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ taskId: 'task', action: 'TASK_COMPLETED' }) });
    await expect(service.completeTask('task', { ...actor, role: 'ASSISTANT', id: 'other-staff' })).rejects.toThrow('Only the task owner');
    tx.followUpTask.findFirst.mockResolvedValue({ id: 'task', status: 'COMPLETED' });
    await expect(service.completeTask('task', actor)).rejects.toThrow('already completed');
  });
});
