import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Search, ArrowLeft, Pencil, Trash2, Wallet, Target, Phone, Building2, CalendarClock, Users, Mail } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { api, ApiError } from '@/lib/api';
import { Avatar, Badge, Skeleton, Select, Input, TextArea } from '@/components/base';
import { toast, Button } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/overlay';
import { formatCurrency, formatDateTime, timeAgo } from '@/lib/format';
import { useBoardHorizontalScroll } from '@/hooks/useBoardHorizontalScroll';

const PIPELINE_STAGES = ['New Lead', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
const STAGE_PROBABILITY: Record<string, number> = { 'New Lead': 10, Contacted: 20, Qualified: 40, Proposal: 60, Negotiation: 80, Won: 100, Lost: 0 };

interface Deal {
  id: string; name: string; value: number; stage: string; probability: number;
  expectedCloseDate?: string | null; notes?: string | null;
  contactId?: string | null;
  contact?: { id: string; name: string; phone: string; avatarUrl?: string | null; email?: string | null; company?: string | null } | null;
  assignedTo?: { id: string; name: string; avatarUrl?: string | null } | null;
  tags: Array<{ id: string; name: string; color: string }>;
  createdAt: string;
  activities?: Array<{ id: string; type: string; title: string; createdAt: string; actor?: { name: string } | null }>;
  tasks?: any[];
}

export function DealsPage() {
  const ws = useAuth((s) => s.currentWorkspaceId);
  const navigate = useNavigate();
  const [pipeline, setPipeline] = React.useState<Array<{ stage: string; items: Deal[]; value: number; count: number }>>([]);
  const [totals, setTotals] = React.useState({ totalValue: 0, weightedValue: 0, wonValue: 0, lostValue: 0 });
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const { ref: boardRef, onWheel } = useBoardHorizontalScroll<HTMLDivElement>();

  const load = React.useCallback(async (q = '') => {
    if (!ws) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('search', q);
      const res = await api.get<{ pipeline: Array<{ stage: string; items: Deal[]; value: number; count: number }>; totals: typeof totals }>(`/api/workspaces/${ws}/deals?${params}`);
      setPipeline(res.pipeline);
      setTotals(res.totals);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load deals');
    } finally {
      setLoading(false);
    }
  }, [ws]);

  React.useEffect(() => {
    const t = setTimeout(() => load(search), 300);
    return () => clearTimeout(t);
  }, [load, search]);

  const moveDeal = async (dealId: string, stage: string) => {
    if (!ws) return;
    setPipeline((prev) => {
      const target = prev.find((g) => g.items.some((d) => d.id === dealId));
      if (!target) return prev;
      const deal = target.items.find((d) => d.id === dealId)!;
      return prev.map((g) => {
        const isFrom = g.stage === target.stage;
        const isTo = g.stage === stage;
        const items = isFrom ? g.items.filter((d) => d.id !== dealId) : isTo ? [{ ...deal, stage, probability: STAGE_PROBABILITY[stage] }, ...g.items] : g.items;
        const value = items.reduce((s, d) => s + d.value, 0);
        return { ...g, items, value, count: items.length };
      });
    });
    try {
      await api.patch<Deal>(`/api/workspaces/${ws}/deals/${dealId}`, { stage });
      toast.success(`Moved to ${stage}`);
      load(search);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Move failed');
      load(search);
    }
  };

  return (
    <div className="flex h-full flex-col bg-ink-50">
      <div className="flex items-center justify-between border-b border-ink-200 bg-white px-5 py-3">
        <div>
          <h1 className="text-lg font-bold text-ink-900">Deals pipeline</h1>
          <p className="text-xs text-ink-500">₹{(totals.totalValue).toLocaleString('en-IN')} total · ₹{(totals.weightedValue).toLocaleString('en-IN')} weighted · ₹{(totals.wonValue).toLocaleString('en-IN')} won</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search deals…" className="h-9 w-full rounded-lg border border-ink-200 bg-ink-50 pl-9 pr-3 text-[13px] focus:border-whatsapp-400 focus:bg-white focus:outline-none" />
          </div>
          <Button onClick={() => setShowCreate(true)} icon={<Plus className="h-4 w-4" />}>New deal</Button>
        </div>
      </div>

      <div ref={boardRef} onWheel={onWheel} className="flex-1 overflow-x-auto overflow-y-hidden">
        {loading && pipeline.length === 0 ? (
          <div className="flex h-full gap-4 p-5">
            {[0, 1, 2, 3].map((i) => <div key={i} className="w-72 shrink-0"><Skeleton className="h-full w-full" /></div>)}
          </div>
        ) : (
          <div className="flex h-full min-w-max gap-4 p-5">
            {pipeline.map((col) => (
              <div
                key={col.stage}
                onDragOver={(e) => { e.preventDefault(); setDragOver(col.stage); }}
                onDragLeave={() => setDragOver((d) => (d === col.stage ? null : d))}
                onDrop={() => { if (dragId) moveDeal(dragId, col.stage); setDragId(null); setDragOver(null); }}
                className={`flex w-72 shrink-0 flex-col rounded-xl border ${dragOver === col.stage ? 'border-whatsapp-400 bg-whatsapp-50/50' : 'border-ink-200 bg-white'} shadow-card`}
              >
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${stageDot(col.stage)}`} />
                    <span className="text-[13px] font-semibold text-ink-900">{col.stage}</span>
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-500">{col.count}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-ink-500">₹{col.value.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto px-2.5 pb-2.5">
                  {col.items.map((d) => (
                    <DealCard key={d.id} deal={d} onDragStart={() => setDragId(d.id)} onOpen={() => navigate(`/deals/${d.id}`)} />
                  ))}
                  {col.items.length === 0 && <div className="rounded-lg border border-dashed border-ink-200 py-6 text-center text-xs text-ink-400">Drop deals here</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateDealModal onClose={() => setShowCreate(false)} onCreated={(d) => navigate(`/deals/${d.id}`)} />}
    </div>
  );
}

function DealCard({ deal, onDragStart, onOpen }: { deal: Deal; onDragStart: () => void; onOpen: () => void }) {
  return (
    <div draggable onDragStart={onDragStart} onClick={onOpen} className="cursor-pointer rounded-lg border border-ink-100 bg-white p-3 shadow-sm transition-shadow hover:shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-ink-900">{deal.name}</div>
          {deal.contact?.name && <div className="truncate text-[11px] text-ink-500">{deal.contact.name}</div>}
        </div>
        {deal.stage === 'Won' && <span className="text-sm">🏆</span>}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[13px] font-bold text-ink-900">{formatCurrency(deal.value)}</span>
        <span className="text-[11px] font-medium text-ink-500">{deal.probability}%</span>
      </div>
      {deal.expectedCloseDate && (
        <div className="mt-1 flex items-center gap-1 text-[11px] text-ink-400">
          <CalendarClock className="h-3 w-3" /> {formatDateTime(deal.expectedCloseDate)}
        </div>
      )}
      <div className="mt-1.5 flex items-center justify-between">
        <div className="flex gap-1">
          {deal.tags.slice(0, 2).map((t) => <Badge key={t.id} label={t.name} />)}
        </div>
        {deal.assignedTo && <Avatar name={deal.assignedTo.name} url={deal.assignedTo.avatarUrl} size="xs" />}
      </div>
    </div>
  );
}

function stageDot(stage: string): string {
  switch (stage) {
    case 'Won': return 'bg-emerald-500';
    case 'Lost': return 'bg-red-500';
    case 'Negotiation': return 'bg-amber-500';
    case 'Proposal': return 'bg-blue-500';
    default: return 'bg-ink-300';
  }
}

function CreateDealModal({ onClose, onCreated }: { onClose: () => void; onCreated: (d: Deal) => void }) {
  const ws = useAuth((s) => s.currentWorkspaceId);
  const [contacts, setContacts] = React.useState<any[]>([]);
  const [form, setForm] = React.useState({ name: '', contactId: '', value: '', stage: 'New Lead', expectedCloseDate: '', notes: '', tags: '' });
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!ws) return;
    api.get<{ items: any[] }>(`/api/workspaces/${ws}/contacts?pageSize=100`).then((r) => setContacts(r.items)).catch(() => {});
  }, [ws]);

  const submit = async () => {
    if (!ws) return;
    setLoading(true);
    try {
      const d = await api.post<Deal>(`/api/workspaces/${ws}/deals`, {
        name: form.name,
        contactId: form.contactId || undefined,
        value: Number(form.value || 0),
        stage: form.stage,
        expectedCloseDate: form.expectedCloseDate ? new Date(form.expectedCloseDate).toISOString() : undefined,
        notes: form.notes,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      toast.success('Deal created');
      onCreated(d);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create deal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New deal" size="lg" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} loading={loading} disabled={!form.name}>Create deal</Button>
      </>
    }>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Deal name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="col-span-2" />
        <Select value={form.contactId} onChange={(v) => setForm((f) => ({ ...f, contactId: v }))} options={contacts.map((c) => ({ value: c.id, label: c.name }))} placeholder="Link contact…" />
        <Input label="Value (₹)" type="number" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} />
        <Select value={form.stage} onChange={(v) => setForm((f) => ({ ...f, stage: v }))} options={PIPELINE_STAGES.map((s) => ({ value: s, label: s }))} />
        <Input label="Expected close date" type="date" value={form.expectedCloseDate} onChange={(e) => setForm((f) => ({ ...f, expectedCloseDate: e.target.value }))} />
        <Input label="Tags (comma separated)" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} className="col-span-2" />
        <TextArea label="Notes" rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="col-span-2" />
      </div>
    </Modal>
  );
}

// ---------------- Deal Detail ----------------

interface DealDetail extends Deal {
  contact?: Deal['contact'] & { conversations?: any[] } | null;
  tasks?: Array<{ id: string; title: string; status: string; dueDate?: string | null }>;
  activities?: Array<{ id: string; type: string; title: string; createdAt: string; actor?: { name: string } | null }>;
}

export function DealDetailPage() {
  const { dealId } = useParams();
  const ws = useAuth((s) => s.currentWorkspaceId);
  const navigate = useNavigate();
  const [deal, setDeal] = React.useState<DealDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!ws || !dealId) return;
    setLoading(true);
    try {
      setDeal(await api.get<DealDetail>(`/api/workspaces/${ws}/deals/${dealId}`));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load deal');
    } finally {
      setLoading(false);
    }
  }, [ws, dealId]);

  React.useEffect(() => { load(); }, [load]);

  const setStage = async (stage: string) => {
    if (!ws) return;
    try {
      await api.patch(`/api/workspaces/${ws}/deals/${dealId}`, { stage });
      await load();
      toast.success(stage === 'Won' ? 'Deal won! 🎉' : `Stage → ${stage}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed');
    }
  };

  const remove = async () => {
    if (!ws) return;
    try {
      await api.delete(`/api/workspaces/${ws}/deals/${dealId}`);
      toast.success('Deal deleted');
      navigate('/deals');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed');
    }
  };

  if (loading || !deal) return <div className="flex h-full items-center justify-center"><Skeleton className="h-40 w-96" /></div>;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-ink-50">
      <div className="flex items-center gap-3 border-b border-ink-200 bg-white px-5 py-3">
        <button onClick={() => navigate('/deals')} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"><ArrowLeft className="h-4 w-4" /></button>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-whatsapp-500 text-lg">💰</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-ink-900">{deal.name}</h1>
            <Badge label={deal.stage} />
            {deal.stage === 'Won' && <Badge label="Won" color="green" />}
          </div>
          <p className="text-xs text-ink-500">₹{deal.value.toLocaleString('en-IN')} · {deal.probability}% probability · created {timeAgo(deal.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={deal.stage} onChange={setStage} options={PIPELINE_STAGES.map((s) => ({ value: s, label: s }))} className="w-36" />
          <Button variant="secondary" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(true)}>Edit</Button>
          <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5 text-red-600" />} onClick={() => setConfirmDelete(true)} />
        </div>
      </div>

      <div className="flex-1 p-5">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-4">
            <Card title="Deal details">
              <div className="space-y-2 text-[13px]">
                <DetailRow icon={<Wallet className="h-3.5 w-3.5" />} label="Value" value={formatCurrency(deal.value)} />
                <DetailRow icon={<Target className="h-3.5 w-3.5" />} label="Probability" value={`${deal.probability}%`} />
                {deal.expectedCloseDate && <DetailRow icon={<CalendarClock className="h-3.5 w-3.5" />} label="Close date" value={formatDateTime(deal.expectedCloseDate)} />}
                {deal.contact?.phone && <DetailRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={deal.contact.phone} />}
                {deal.contact?.email && <DetailRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={deal.contact.email} />}
                {deal.contact?.company && <DetailRow icon={<Building2 className="h-3.5 w-3.5" />} label="Company" value={deal.contact.company} />}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {deal.tags.map((t) => <Badge key={t.id} label={t.name} />)}
              </div>
            </Card>

            <Card title="Owner">
              <div className="flex items-center gap-2">
                {deal.assignedTo ? <Avatar name={deal.assignedTo.name} url={deal.assignedTo.avatarUrl} size="sm" /> : <Users className="h-5 w-5 text-ink-300" />}
                <span className="text-[13px] text-ink-800">{deal.assignedTo?.name ?? 'Unassigned'}</span>
              </div>
              {deal.contact && (
                <button onClick={() => navigate(`/contacts/${deal.contact!.id}`)} className="mt-3 w-full rounded-lg border border-ink-200 px-3 py-2 text-left hover:bg-ink-50">
                  <div className="text-[11px] uppercase text-ink-400">Linked contact</div>
                  <div className="text-[13px] font-medium text-ink-900">{deal.contact.name}</div>
                </button>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card title="Notes">
              {deal.notes ? <p className="whitespace-pre-wrap text-[13px] text-ink-800">{deal.notes}</p> : <p className="text-xs text-ink-400">No notes yet.</p>}
            </Card>

            <Card title={`Tasks (${deal.tasks?.length ?? 0})`}>
              {deal.tasks?.map((t) => (
                <div key={t.id} className="mb-2 flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2">
                  <span className="text-[13px] text-ink-800">{t.title}</span>
                  <Badge label={t.status} />
                </div>
              ))}
              {(!deal.tasks || deal.tasks.length === 0) && <p className="text-xs text-ink-400">No tasks linked to this deal.</p>}
            </Card>
          </div>

          <div className="space-y-4">
            <Card title="Activity timeline">
              <div className="relative ml-2 space-y-3 border-l border-ink-200 pl-4">
                {deal.activities?.map((a) => (
                  <div key={a.id} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-whatsapp-400" />
                    <div className="text-[13px] font-medium text-ink-800">{a.title}</div>
                    <div className="text-[11px] text-ink-400">{a.actor?.name ? `by ${a.actor.name} · ` : ''}{timeAgo(a.createdAt)}</div>
                  </div>
                ))}
                {(!deal.activities || deal.activities.length === 0) && <p className="text-xs text-ink-400">No activity yet.</p>}
              </div>
            </Card>

            <Card title="Conversations">
              {deal.contact?.conversations?.slice(0, 4).map((c: any) => (
                <button key={c.id} onClick={() => navigate(`/inbox/${c.id}`)} className="mb-2 flex w-full items-center justify-between rounded-lg border border-ink-100 px-3 py-2 text-left hover:bg-ink-50">
                  <div className="truncate text-[13px] text-ink-800">{c.lastMessageText || 'Conversation'}</div>
                  <span className="text-[11px] text-ink-400">{timeAgo(c.lastMessageAt)}</span>
                </button>
              )) ?? <p className="text-xs text-ink-400">No conversations</p>}
            </Card>
          </div>
        </div>
      </div>

      {editing && (
        <EditDealModal deal={deal} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />
      )}
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={remove} title="Delete deal" message={`Delete deal "${deal.name}"? This cannot be undone.`} confirmLabel="Delete" />
    </div>
  );
}

function EditDealModal({ deal, onClose, onSaved }: { deal: DealDetail; onClose: () => void; onSaved: () => void }) {
  const ws = useAuth((s) => s.currentWorkspaceId);
  const [form, setForm] = React.useState({
    name: deal.name, value: String(deal.value), stage: deal.stage, probability: String(deal.probability),
    expectedCloseDate: deal.expectedCloseDate ? deal.expectedCloseDate.slice(0, 10) : '', notes: deal.notes ?? '', tags: deal.tags.map((t) => t.name).join(', '),
  });
  const [loading, setLoading] = React.useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!ws) return;
    setLoading(true);
    try {
      await api.patch(`/api/workspaces/${ws}/deals/${deal.id}`, {
        name: form.name, value: Number(form.value), stage: form.stage, probability: Number(form.probability),
        expectedCloseDate: form.expectedCloseDate ? new Date(form.expectedCloseDate).toISOString() : null,
        notes: form.notes,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      toast.success('Deal updated');
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Edit deal" size="lg" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} loading={loading}>Save changes</Button>
      </>
    }>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Deal name" value={form.name} onChange={set('name')} className="col-span-2" />
        <Input label="Value (₹)" type="number" value={form.value} onChange={set('value')} />
        <Input label="Probability (%)" type="number" value={form.probability} onChange={set('probability')} />
        <Select value={form.stage} onChange={(v) => setForm((f) => ({ ...f, stage: v }))} options={PIPELINE_STAGES.map((s) => ({ value: s, label: s }))} />
        <Input label="Expected close date" type="date" value={form.expectedCloseDate} onChange={set('expectedCloseDate')} />
        <Input label="Tags" value={form.tags} onChange={set('tags')} className="col-span-2" />
        <TextArea label="Notes" rows={3} value={form.notes} onChange={set('notes')} className="col-span-2" />
      </div>
    </Modal>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-card">
      <h3 className="mb-3 text-[13px] font-semibold text-ink-900">{title}</h3>
      {children}
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex w-6 items-center text-ink-400">{icon}</span>
      <span className="text-ink-500">{label}</span>
      <span className="ml-auto truncate font-medium text-ink-900">{value}</span>
    </div>
  );
}