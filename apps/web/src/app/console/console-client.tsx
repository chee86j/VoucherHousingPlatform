'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core';

type Client = { id: string; legalName: string; pipelineStage: string };
type Case = { id: string; clientId: string; stage: string; stageEnteredAt: string; stalled: boolean };
type Showing = { id: string; unitId: string; startsAt: string; endsAt: string; status: string; participants: { clientId: string; status: string }[] };
type Task = { id: string; title: string; dueAt: string; status: string; ownerUserId: string };
type Unit = { id: string; propertyId: string; bedrooms: number; askingRentCents: number; status: string };
type Props = { user: { id: string; name: string; role: string }; clients: Client[]; cases: Case[]; showings: Showing[]; tasks: Task[]; units: Unit[]; totals: { clients: number; units: number } };
const stages = ['INQUIRY', 'INTAKE', 'VOUCHER_REVIEW', 'DOCUMENT_COLLECT', 'READY', 'MATCHED'] as const;
const next: Record<string, { stage: string; action: string; label: string }> = {
  INQUIRY: { stage: 'INTAKE', action: 'intake_completed', label: 'Complete intake' },
  INTAKE: { stage: 'VOUCHER_REVIEW', action: 'voucher_submitted', label: 'Submit voucher for review' },
};
const label = (value: string) => value.toLowerCase().replace(/_/g, ' ').replace(/^./, (letter: string) => letter.toUpperCase());
const date = (value: string) => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
function CaseCard({ record, name, advance }: { record: Case; name: string; advance?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: record.id });
  return <li ref={setNodeRef} style={transform ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)`, opacity: isDragging ? 0.5 : 1 } : undefined} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
    <p className="font-semibold text-slate-900">{name}</p><p className="mt-1 text-xs text-slate-600">Entered {date(record.stageEnteredAt)}{record.stalled ? ' · Needs follow-up' : ''}</p>
    {advance && <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={advance} className="rounded bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800">{next[record.stage].label}</button><button type="button" {...attributes} {...listeners} aria-label={`Drag ${name} from ${label(record.stage)} to ${label(next[record.stage].stage)}; use ${next[record.stage].label} button instead`} className="rounded border px-2 py-1 text-xs touch-none">Drag</button></div>}
  </li>;
}
function Column({ stage, children }: { stage: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return <section ref={setNodeRef} aria-label={`${label(stage)} stage`} className={`min-w-64 flex-1 rounded-xl border p-3 ${isOver ? 'border-sky-600 bg-sky-50' : 'border-slate-200 bg-slate-50'}`}><h3 className="mb-3 text-sm font-bold text-slate-800">{label(stage)}</h3><ul className="space-y-2">{children}</ul></section>;
}
export default function Console({ user, clients, cases, showings, tasks, units, totals }: Props) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [unitId, setUnitId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const names = new Map(clients.map(client => [client.id, client.legalName]));
  const unitNames = new Map(units.map(unit => [unit.id, `${unit.bedrooms}BR · $${(unit.askingRentCents / 100).toLocaleString()}/mo`]));
  const canManage = user.role === 'BROKER' || user.role === 'ADMIN';
  const upcoming = showings.filter(showing => showing.status === 'SCHEDULED' && new Date(showing.endsAt) > new Date());
  const recent = showings.filter(showing => showing.status === 'SCHEDULED' && new Date(showing.endsAt).getTime() > Date.now() - 30 * 86400000);
  const openTasks = tasks.filter(task => task.status === 'OPEN');
  async function act(path: string, body: object, method: 'POST' | 'PATCH' = 'POST') {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/console/${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store', credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.message === 'string' ? result.message : typeof result.error === 'string' ? result.error : 'Action failed');
      setNotice('Saved. Workspace refreshed.'); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Action failed'); }
    finally { setBusy(false); }
  }
  function transition(record: Case) { const move = next[record.stage]; if (move && canManage) void act(`cases/${record.id}/transitions`, { action: move.action }); }
  function dropped(event: DragEndEvent) {
    const record = cases.find(item => item.id === event.active.id);
    if (record && canManage && next[record.stage]?.stage === event.over?.id) transition(record);
  }
  async function logout() {
    const response = await fetch('/api/session/logout', { method: 'POST', credentials: 'same-origin' });
    if (response.ok) { router.replace('/auth/login'); router.refresh(); } else setError('Sign out failed');
  }
  return <div className="min-h-screen bg-slate-100 text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5"><div><p className="text-xs font-bold uppercase tracking-widest text-sky-700">Voucher Housing Platform</p><h1 className="text-2xl font-bold">Broker console</h1><p className="text-sm text-slate-600">Internal operations only · {user.name} ({label(user.role)})</p></div><button type="button" onClick={() => void logout()} className="rounded border border-slate-400 px-4 py-2 text-sm font-medium hover:bg-slate-100">Sign out</button></div></header>
    <main className="mx-auto max-w-7xl space-y-8 px-5 py-8">
      <nav aria-label="Console sections" className="flex flex-wrap gap-4 text-sm font-semibold text-sky-800"><a href="#pipeline">Case pipeline</a><a href="#inventory">3BR+ inventory</a><a href="#showings">Showings</a><a href="#tasks">Follow-up</a></nav>
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Prototype with incomplete document readiness and audit controls. Do not enter real client data or share this console externally.</p>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}{notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-800">{notice}</p>}
      <section aria-label="Overview" className="grid gap-4 sm:grid-cols-3">{[["Clients in book", totals.clients], ["Upcoming showings", upcoming.length], ["Open follow-ups", openTasks.length]].map(([text, count]) => <div key={text} className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-600">{text}</p><p className="mt-1 text-3xl font-bold">{count}</p></div>)}</section>
      <section id="pipeline" aria-labelledby="pipeline-title"><div className="mb-3"><h2 id="pipeline-title" className="text-xl font-bold">Case pipeline</h2><p className="text-sm text-slate-600">Drag early-stage cards or use their action buttons. The API validates every transition; later stages require evidence not yet available.</p></div><DndContext onDragEnd={dropped}><div className="flex gap-3 overflow-x-auto pb-3">{stages.map(stage => <Column key={stage} stage={stage}>{cases.filter(record => record.stage === stage).map(record => <CaseCard key={record.id} record={record} name={names.get(record.clientId) || 'Client outside current page'} advance={canManage && next[stage] && !busy ? () => transition(record) : undefined} />)}</Column>)}</div></DndContext>{cases.length === 0 && <p className="text-sm text-slate-600">No cases in this workspace.</p>}{cases.length >= 100 && <p className="text-sm text-amber-900">Showing the first 100 cases. Pagination is pending.</p>}</section>
      <section id="inventory" aria-labelledby="inventory-title" className="rounded-xl bg-white p-5"><h2 id="inventory-title" className="text-xl font-bold">3BR+ property inventory</h2><p className="text-sm text-slate-600">Availability facts only; no applicant ranking.</p><ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{units.filter(unit => unit.bedrooms >= 3).map(unit => <li key={unit.id} className="rounded border p-3"><strong>{unitNames.get(unit.id)}</strong><p className="text-sm text-slate-600">{label(unit.status)} · Unit {unit.id}</p></li>)}</ul>{units.filter(unit => unit.bedrooms >= 3).length === 0 && <p className="mt-3 text-sm">No 3BR+ units in the current page.</p>}{totals.units > units.length && <p className="mt-2 text-sm text-amber-900">Additional units are not shown yet.</p>}</section>
      <section id="showings" aria-labelledby="showings-title" className="rounded-xl bg-white p-5"><h2 id="showings-title" className="text-xl font-bold">Grouped showings</h2><ul className="mt-4 space-y-4">{recent.map(showing => <li key={showing.id} className="rounded border p-4"><h3 className="font-semibold">{unitNames.get(showing.unitId) || 'Unit outside current page'} · {date(showing.startsAt)}</h3><p className="text-sm text-slate-600">Ends {date(showing.endsAt)} · {showing.participants.length} participants</p><ul className="mt-2 space-y-2">{showing.participants.map(participant => <li key={participant.clientId} className="flex flex-wrap items-center gap-2 text-sm"><span>{names.get(participant.clientId) || 'Client outside current page'} · {label(participant.status)}</span>{participant.status === 'INVITED' && new Date(showing.startsAt) > new Date() && <><button disabled={busy} onClick={() => void act(`showings/${showing.id}/participants/${participant.clientId}`, { status: 'CONFIRMED' }, 'PATCH')} className="rounded border px-2 py-1 hover:bg-slate-50">Confirm</button><button disabled={busy} onClick={() => void act(`showings/${showing.id}/participants/${participant.clientId}`, { status: 'DECLINED' }, 'PATCH')} className="rounded border px-2 py-1 hover:bg-slate-50">Decline</button></>}{participant.status === 'CONFIRMED' && new Date(showing.startsAt) <= new Date() && <button disabled={busy} onClick={() => void act(`showings/${showing.id}/participants/${participant.clientId}`, { status: 'ATTENDED' }, 'PATCH')} className="rounded border px-2 py-1">Mark attended</button>}{participant.status === 'CONFIRMED' && new Date(showing.endsAt) <= new Date() && <button disabled={busy} onClick={() => void act(`showings/${showing.id}/participants/${participant.clientId}`, { status: 'NO_SHOW' }, 'PATCH')} className="rounded border px-2 py-1">Mark no-show</button>}</li>)}</ul></li>)}</ul>{recent.length === 0 && <p className="mt-3 text-sm">No recent or upcoming showings.</p>}
        {canManage && <form className="mt-6 grid gap-3 border-t pt-5 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); const start = new Date(String(form.get('startsAt'))); const end = new Date(String(form.get('endsAt'))); if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start <= new Date() || end <= start) { setError('Choose a future start and later end time.'); return; } void act('showings', { unitId, clientIds: selected, startsAt: start.toISOString(), endsAt: end.toISOString() }); }}><h3 className="sm:col-span-2 font-semibold">Schedule a showing</h3><label className="text-sm">Available unit<select required value={unitId} onChange={event => setUnitId(event.target.value)} className="mt-1 block w-full rounded border p-2"><option value="">Select a unit</option>{units.filter(unit => unit.status === 'AVAILABLE' && unit.bedrooms >= 3).map(unit => <option key={unit.id} value={unit.id}>{unitNames.get(unit.id)} · {unit.id}</option>)}</select></label><fieldset className="rounded border p-2"><legend className="text-sm font-medium">Clients to invite (manual selection)</legend><div className="max-h-28 overflow-auto">{clients.map(client => <label key={client.id} className="flex gap-2 text-sm"><input type="checkbox" checked={selected.includes(client.id)} onChange={event => setSelected(old => event.target.checked ? [...old, client.id] : old.filter(id => id !== client.id))} />{client.legalName}</label>)}</div></fieldset><label className="text-sm">Start (local time)<input required type="datetime-local" name="startsAt" className="mt-1 block w-full rounded border p-2" /></label><label className="text-sm">End (local time)<input required type="datetime-local" name="endsAt" className="mt-1 block w-full rounded border p-2" /></label><p className="sm:col-span-2 text-xs text-slate-600">Selecting a client records an internal invitation only. Verify voucher fit and readiness manually; no message is sent.</p><button disabled={busy || !selected.length || !unitId} className="rounded bg-sky-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Schedule showing</button></form>}
      </section>
      <section id="tasks" aria-labelledby="tasks-title" className="rounded-xl bg-white p-5"><h2 id="tasks-title" className="text-xl font-bold">Follow-up tasks</h2><ul className="mt-3 space-y-2">{openTasks.map(task => <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"><span><strong>{task.title}</strong><span className="block text-xs text-slate-600">Due {date(task.dueAt)}{task.ownerUserId === user.id ? ' · Assigned to you' : ''}</span></span>{(canManage || task.ownerUserId === user.id) && <button disabled={busy} onClick={() => void act(`follow-up-tasks/${task.id}/complete`, {})} className="rounded border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50">Mark complete</button>}</li>)}</ul>{openTasks.length === 0 && <p className="mt-3 text-sm">No open follow-ups.</p>}</section>
    </main>
  </div>;
}
