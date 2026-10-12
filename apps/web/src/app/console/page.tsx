import { redirect } from 'next/navigation';
import { getSessionToken, getSessionUser, internalApiUrl } from '@/lib/session';
import Console from './console-client';

export const dynamic = 'force-dynamic';
type Client = { id: string; legalName: string; pipelineStage: string };
type Case = { id: string; clientId: string; stage: string; stageEnteredAt: string; stalled: boolean };
type Showing = { id: string; unitId: string; startsAt: string; endsAt: string; status: string; participants: { clientId: string; status: string }[] };
type Task = { id: string; title: string; dueAt: string; status: string; ownerUserId: string };
type Unit = { id: string; propertyId: string; bedrooms: number; askingRentCents: number; status: string };
async function api<T>(path: string, token: string): Promise<T> {
  const response = await fetch(internalApiUrl(path), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', redirect: 'error' });
  if (!response.ok) throw new Error('Console data is currently unavailable');
  return response.json();
}
export default async function ConsolePage() {
  const user = await getSessionUser();
  if (!user || !['ADMIN', 'BROKER', 'ASSISTANT'].includes(user.role)) redirect('/auth/login');
  const token = await getSessionToken();
  if (!token) redirect('/auth/login');
  try {
    const [clientList, cases, showings, tasks, unitList] = await Promise.all([
      api<{ clients: Client[]; total: number }>('clients?limit=50', token), api<Case[]>('cases', token),
      api<Showing[]>('showings', token), api<Task[]>('follow-up-tasks', token), api<{ units: Unit[]; total: number }>('units?limit=50', token),
    ]);
    // Serialize only operational fields; never place voucher program, household, notes or documents in the browser payload.
    return <Console user={{ id: user.id, name: user.name, role: user.role }}
      clients={clientList.clients.map(({ id, legalName, pipelineStage }) => ({ id, legalName, pipelineStage }))}
      cases={cases.map(({ id, clientId, stage, stageEnteredAt, stalled }) => ({ id, clientId, stage, stageEnteredAt, stalled }))}
      showings={showings.map(({ id, unitId, startsAt, endsAt, status, participants }) => ({ id, unitId, startsAt, endsAt, status, participants: participants.map(({ clientId, status }) => ({ clientId, status })) }))}
      tasks={tasks.map(({ id, title, dueAt, status, ownerUserId }) => ({ id, title, dueAt, status, ownerUserId }))}
      units={unitList.units.map(({ id, propertyId, bedrooms, askingRentCents, status }) => ({ id, propertyId, bedrooms, askingRentCents, status }))}
      totals={{ clients: clientList.total, units: unitList.total }} />;
  } catch {
    return <main className="mx-auto max-w-3xl p-8"><h1 className="text-2xl font-bold">Broker console unavailable</h1><p role="alert" className="mt-3">The API could not load your workspace. No client data was displayed. Please try again later.</p></main>;
  }
}
