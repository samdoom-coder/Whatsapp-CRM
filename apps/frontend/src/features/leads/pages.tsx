import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Search, ArrowLeft, Pencil, Trash2, Sparkles, Target, Phone, Wallet, CalendarClock, Building2, Users, Mail } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { api, ApiError } from '@/lib/api';
import { Avatar, Badge, Skeleton, Select, Input, TextArea } from '@/components/base';
import { toast, Button } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/overlay';
import { formatCurrency, formatDateTime, timeAgo } from '@/lib/format';
import { useBoardHorizontalScroll } from '@/hooks/useBoardHorizontalScroll';

const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted', 'Lost'];

interface Lead {
  id: string; name: string; phone: string; source: string; status: string; score: number;
  estimatedValue?: number | null; expectedCloseDate?: string | null; notes?: string | null;
  contactId: string;
  contact?: { id: string; name: string; phone: string; avatarUrl?: string | null; email?: string | null; company?: string | null } | null;
  assignedTo?: { id: string; name: string; avatarUrl?: string | null } | null;
  tags: Array<{ id: string; name: string; color: string }>;
  createdAt: string;
}

export function LeadsPage() {
  const ws = useAuth((s) => s.currentWorkspaceId);
  const navigate = useNavigate();
  const [grouped, setGrouped] = React.useState<Array<{ status: string; items: Lead[] }>>([]);
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
      const params = new URLSearchParams({ pageSize: '200' });
      if (q) params.set('search', q);
      const res = await api.get<{ grouped: Array<{ status: string; items: Lead[] }> }>(`/api/workspaces/${ws}/leads?${params}`);
      setGrouped(res.grouped);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [ws]);

  React.useEffect(() => {
    const t = setTimeout(() => load(search), 300);
    return () => clearTimeout(t);
  }, [load, search]);

  const moveLead = async (leadId: string, status: string) => {
    if (!ws) return;
    // optimistic update
    setGrouped((prev) => {
      const target = prev.find((g) => g.items.some((l) => l.id === leadId));
      if (!target) return prev;
      const lead = target.items.find((l) => l.id === leadId)!;
      return prev.map((g) => ({
        ...g,
        items: g.status === target.status
          ? g.items.filter((l) => l.id !== leadId)
          : g.status === status
            ? [{ ...lead, status }, ...g.items]
            : g.items,
      }));
    });
    try {
      const updated = await api.patch<Lead>(`/api/workspaces/${ws}/leads/${leadId}`, { status });
      toast.success(`Moved to ${status}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Move failed');
      load(search);
    }
  };

  return (
    <div className="flex h-full flex-col bg-ink-50">
      <div className="flex items-center justify-between border-b border-ink-200 bg-white px-5 py-3">
        <div>
          <h1 className="text-lg font-bold text-ink-900">Leads</h1>
          <p className="text-xs text-ink-500">Drag cards between columns to update status</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads…" className="h-9 w-full rounded-lg border border-ink-200 bg-ink-50 pl-9 pr-3 text-[13px] focus:border-whatsapp-400 focus:bg-white focus:outline-none" />
          </div>
          <Button onClick={() => setShowCreate(true)} icon={<Plus className="h-4 w-4" />}>New lead</Button>
        </div>
      </div>

      <div ref={boardRef} onWheel={onWheel} className="flex-1 overflow-x-auto overflow-y-hidden">
        {loading && grouped.length === 0 ? (
          <div className="flex h-full gap-4 p-5">
            {[0, 1, 2].map((i) => <div key={i} className="w-72 shrink-0"><Skeleton className="h-full w-full" /></div>)}
          </div>
        ) : (
          <div className="flex h-full min-w-max gap-4 p-5">
            {grouped.map((col) => (
              <div
                key={col.status}
                onDragOver={(e) => { e.preventDefault(); setDragOver(col.status); }}
                onDragLeave={() => setDragOver((d) => (d === col.status ? null : d))}
                onDrop={() => { if (dragId) moveLead(dragId, col.status); setDragId(null); setDragOver(null); }}
                className={`flex w-72 shrink-0 flex-col rounded-xl border ${dragOver === col.status ? 'border-whatsapp-400 bg-whatsapp-50/50' : 'border-ink-200 bg-white'} shadow-card`}
              >
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-ink-900">{col.status}</span>
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-500">{col.items.length}</span>
                  </div>
                  {col.status === 'New' && (
                    <button onClick={() => setShowCreate(true)} className="text-ink-400 hover:text-whatsapp-600"><Plus className="h-4 w-4" /></button>
                  )}
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto px-2.5 pb-2.5">
                  {col.items.map((l) => (
                    <LeadCard key={l.id} lead={l} draggable onDragStart={() => setDragId(l.id)} onOpen={() => navigate(`/leads/${l.id}`)} />
                  ))}
                  {col.items.length === 0 && <div className="rounded-lg border border-dashed border-ink-200 py-6 text-center text-xs text-ink-400">Drop leads here</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateLeadModal onClose={() => setShowCreate(false)} onCreated={(l) => navigate(`/leads/${l.id}`)} />}
    </div>
  );
}

export function LeadCard({ lead, draggable, onDragStart, onOpen }: { lead: Lead; draggable?: boolean; onDragStart?: () => void; onOpen?: () => void }) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onOpen}
      className="cursor-pointer rounded-lg border border-ink-100 bg-white p-3 shadow-sm transition-shadow hover:shadow-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-ink-900">{lead.name}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-500">
            <Phone className="h-3 w-3" /> {lead.phone}
          </div>
        </div>
        <div className="text-right">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${lead.score >= 70 ? 'bg-orange-100 text-orange-600' : lead.score >= 40 ? 'bg-amber-100 text-amber-600' : 'bg-ink-100 text-ink-500'}`}>
            {lead.score}
          </span>
          {lead.score >= 70 && <div className="text-[9px] font-bold text-orange-500">🔥 HOT</div>}
        </div>
      </div>
      {lead.estimatedValue != null && (
        <div className="mt-1.5 text-[12px] font-medium text-ink-700">{formatCurrency(lead.estimatedValue)}</div>
      )}
      <div className="mt-1.5 flex items-center justify-between">
        <div className="flex gap-1">
          {lead.tags.slice(0, 2).map((t) => <Badge key={t.id} label={t.name} />)}
          {lead.source && <Badge label={lead.source} color="gray" />}
        </div>
        {lead.assignedTo && <Avatar name={lead.assignedTo.name} url={lead.assignedTo.avatarUrl} size="xs" />}
      </div>
    </div>
  );
}

function CreateLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: (l: Lead) => void }) {
  const ws = useAuth((s) => s.currentWorkspaceId);
  const [contacts, setContacts] = React.useState<any[]>([]);
  const [form, setForm] = React.useState({ contactId: '', name: '', phone: '', source: 'WhatsApp', status: 'New', score: '50', estimatedValue: '', tags: '' });
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!ws) return;
    api.get<{ items: any[] }>(`/api/workspaces/${ws}/contacts?pageSize=100`).then((r) => setContacts(r.items)).catch(() => {});
  }, [ws]);

  const submit = async () => {
    if (!ws) return;
    setLoading(true);
    try {
      const l = await api.post<Lead>(`/api/workspaces/${ws}/leads`, {
        contactId: form.contactId,
        name: form.name,
        phone: form.phone,
        source: form.source,
        status: form.status,
        score: Number(form.score),
        estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : undefined,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      toast.success('Lead created');
      onCreated(l);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create lead');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New lead" size="lg" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} loading={loading} disabled={!form.contactId && !form.name}>Create lead</Button>
      </>
    }>
      <div className="grid grid-cols-2 gap-3">
        <Select
          value={form.contactId}
          onChange={(v) => {
            const c = contacts.find((x) => x.id === v);
            setForm((f) => ({ ...f, contactId: v, name: c?.name ?? f.name, phone: c?.phone ?? f.phone }));
          }}
          options={contacts.map((c) => ({ value: c.id, label: c.name }))}
          placeholder="Choose contact…"
          className="col-span-2"
        />
        <Input label="Lead name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <Input label="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        <Select value={form.source} onChange={(v) => setForm((f) => ({ ...f, source: v }))} options={['WhatsApp', 'Instagram', 'Facebook', 'Website', 'Referral', 'Campaign', 'Cold Call', 'Other'].map((s) => ({ value: s, label: s }))} />
        <Select value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v }))} options={LEAD_STATUSES.map((s) => ({ value: s, label: s }))} />
        <Input label="Score (0-100)" type="number" value={form.score} onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))} />
        <Input label="Estimated value (₹)" type="number" value={form.estimatedValue} onChange={(e) => setForm((f) => ({ ...f, estimatedValue: e.target.value }))} />
        <Input label="Tags (comma separated)" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} className="col-span-2" />
      </div>
    </Modal>
  );
}

// ---------------- Lead Detail ----------------

interface LeadDetail extends Lead {
  notes?: string | null;
  contact?: Lead['contact'] & { conversations?: any[]; deals?: any[] } | null;
}

export function LeadDetailPage() {
  const { leadId } = useParams();
  const ws = useAuth((s) => s.currentWorkspaceId);
  const navigate = useNavigate();
  const [lead, setLead] = React.useState<LeadDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [ai, setAi] = React.useState<{ intent: string; confidence: number; temperature: string; recommendedAction: string; summary: string[] } | null>(null);
  const [aiLoading, setAiLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!ws || !leadId) return;
    setLoading(true);
    try {
      setLead(await api.get<LeadDetail>(`/api/workspaces/${ws}/leads/${leadId}`));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load lead');
    } finally {
      setLoading(false);
    }
  }, [ws, leadId]);

  React.useEffect(() => { load(); }, [load]);

  const analyze = async () => {
    if (!ws) return;
    setAiLoading(true);
    try {
      const res = await api.post<{ intent: string; confidence: number; temperature: string; recommendedAction: string; summary: string[] }>(`/api/ai/leads/${leadId}/analyze`);
      setAi(res);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'AI analysis unavailable');
    } finally {
      setAiLoading(false);
    }
  };

  const setStatus = async (status: string) => {
    if (!ws || !lead) return;
    try {
      await api.patch(`/api/workspaces/${ws}/leads/${leadId}`, { status });
      await load();
      toast.success(`Status → ${status}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed');
    }
  };

  const remove = async () => {
    if (!ws) return;
    try {
      await api.delete(`/api/workspaces/${ws}/leads/${leadId}`);
      toast.success('Lead deleted');
      navigate('/leads');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed');
    }
  };

  if (loading || !lead) return <div className="flex h-full items-center justify-center"><Skeleton className="h-40 w-96" /></div>;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-ink-50">
      <div className="flex items-center gap-3 border-b border-ink-200 bg-white px-5 py-3">
        <button onClick={() => navigate('/leads')} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"><ArrowLeft className="h-4 w-4" /></button>
        <Avatar name={lead.name} url={lead.contact?.avatarUrl} size="md" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-ink-900">{lead.name}</h1>
            <Badge label={lead.status} />
            {lead.score >= 70 && <Badge label="Hot" color="amber" />}
          </div>
          <p className="text-xs text-ink-500">{lead.source} lead · created {timeAgo(lead.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={lead.status} onChange={setStatus} options={LEAD_STATUSES.map((s) => ({ value: s, label: s }))} className="w-36" />
          <Button variant="secondary" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(true)}>Edit</Button>
          <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5 text-red-600" />} onClick={() => setConfirmDelete(true)} />
        </div>
      </div>

      <div className="flex-1 p-5">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-4">
            <Card title="Lead details">
              <div className="space-y-2 text-[13px]">
                <DetailRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={lead.phone} />
                {lead.contact?.email && <DetailRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={lead.contact.email} />}
                {lead.contact?.company && <DetailRow icon={<Building2 className="h-3.5 w-3.5" />} label="Company" value={lead.contact.company} />}
                <DetailRow icon={<Wallet className="h-3.5 w-3.5" />} label="Est. value" value={lead.estimatedValue != null ? formatCurrency(lead.estimatedValue) : '—'} />
                {lead.expectedCloseDate && <DetailRow icon={<CalendarClock className="h-3.5 w-3.5" />} label="Close date" value={formatDateTime(lead.expectedCloseDate)} />}
                <DetailRow icon={<Target className="h-3.5 w-3.5" />} label="Score" value={`${lead.score}/100`} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {lead.tags.map((t) => <Badge key={t.id} label={t.name} />)}
              </div>
            </Card>

            <Card title="AI Analysis">
              <Button className="w-full" icon={<Sparkles className="h-4 w-4" />} onClick={analyze} loading={aiLoading}>Analyze this lead</Button>
              {ai && (
                <div className="mt-2 space-y-1.5 rounded-lg border border-violet-200 bg-violet-50 p-3 text-[12px]">
                  <div className="flex justify-between font-medium text-violet-800">
                    <span>Intent: {ai.intent}</span><span>{ai.confidence}%</span>
                  </div>
                  <div className="font-medium text-violet-800">Temperature: <span className={ai.temperature === 'Hot' ? 'text-orange-600' : ai.temperature === 'Warm' ? 'text-amber-600' : 'text-blue-600'}>{ai.temperature}</span></div>
                  <div className="text-violet-900"><span className="font-semibold">Recommended:</span> {ai.recommendedAction}</div>
                  {ai.summary.length > 0 && (
                    <ul className="list-inside list-disc space-y-0.5 text-[11px] text-violet-800">
                      {ai.summary.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card title="Notes">
              {lead.notes ? <p className="whitespace-pre-wrap text-[13px] text-ink-800">{lead.notes}</p> : <p className="text-xs text-ink-400">No notes. Edit the lead to add notes.</p>}
            </Card>

            <Card title="Conversations">
              {lead.contact?.conversations?.slice(0, 5).map((c: any) => (
                <button key={c.id} onClick={() => navigate(`/inbox/${c.id}`)} className="mb-2 flex w-full items-center justify-between rounded-lg border border-ink-100 px-3 py-2 text-left hover:bg-ink-50">
                  <div className="truncate text-[13px] text-ink-800">{c.lastMessageText || 'Conversation'}</div>
                  <span className="text-[11px] text-ink-400">{timeAgo(c.lastMessageAt)}</span>
                </button>
              )) ?? <p className="text-xs text-ink-400">No conversations</p>}
            </Card>

            <Card title="Related deals">
              {lead.contact?.deals?.map((d: any) => (
                <button key={d.id} onClick={() => navigate(`/deals/${d.id}`)} className="mb-2 flex w-full items-center justify-between rounded-lg border border-ink-100 px-3 py-2 text-left hover:bg-ink-50">
                  <span className="text-[13px] font-medium text-ink-900">{d.name}</span>
                  <div className="text-right">
                    <div className="text-[12px] font-bold text-ink-900">{formatCurrency(d.value)}</div>
                    <Badge label={d.stage} />
                  </div>
                </button>
              )) ?? <p className="text-xs text-ink-400">No deals yet</p>}
            </Card>
          </div>

          <div className="space-y-4">
            <Card title="Owner">
              <div className="flex items-center gap-2">
                {lead.assignedTo ? <Avatar name={lead.assignedTo.name} url={lead.assignedTo.avatarUrl} size="sm" /> : <Users className="h-5 w-5 text-ink-300" />}
                <span className="text-[13px] text-ink-800">{lead.assignedTo?.name ?? 'Unassigned'}</span>
              </div>
              {lead.contact && (
                <button onClick={() => navigate(`/contacts/${lead.contact!.id}`)} className="mt-3 w-full rounded-lg border border-ink-200 px-3 py-2 text-left hover:bg-ink-50">
                  <div className="text-[11px] uppercase text-ink-400">Linked contact</div>
                  <div className="text-[13px] font-medium text-ink-900">{lead.contact.name}</div>
                  <div className="text-[11px] text-ink-500">{lead.contact.phone}</div>
                </button>
              )}
            </Card>
          </div>
        </div>
      </div>

      {editing && (
        <EditLeadModal lead={lead} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />
      )}
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={remove} title="Delete lead" message={`Delete lead "${lead.name}"? This cannot be undone.`} confirmLabel="Delete" />
    </div>
  );
}

function EditLeadModal({ lead, onClose, onSaved }: { lead: LeadDetail; onClose: () => void; onSaved: () => void }) {
  const ws = useAuth((s) => s.currentWorkspaceId);
  const [form, setForm] = React.useState({
    name: lead.name, phone: lead.phone, source: lead.source, status: lead.status,
    score: String(lead.score), estimatedValue: lead.estimatedValue != null ? String(lead.estimatedValue) : '',
    expectedCloseDate: lead.expectedCloseDate ? lead.expectedCloseDate.slice(0, 10) : '', notes: lead.notes ?? '', tags: lead.tags.map((t) => t.name).join(', '),
  });
  const [loading, setLoading] = React.useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!ws) return;
    setLoading(true);
    try {
      await api.patch(`/api/workspaces/${ws}/leads/${lead.id}`, {
        name: form.name, phone: form.phone, source: form.source, status: form.status,
        score: Number(form.score),
        estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : null,
        expectedCloseDate: form.expectedCloseDate ? new Date(form.expectedCloseDate).toISOString() : null,
        notes: form.notes,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      toast.success('Lead updated');
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Edit lead" size="lg" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} loading={loading}>Save changes</Button>
      </>
    }>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Lead name" value={form.name} onChange={set('name')} />
        <Input label="Phone" value={form.phone} onChange={set('phone')} />
        <Select value={form.source} onChange={(v) => setForm((f) => ({ ...f, source: v }))} options={['WhatsApp', 'Instagram', 'Facebook', 'Website', 'Referral', 'Campaign', 'Cold Call', 'Other'].map((s) => ({ value: s, label: s }))} />
        <Select value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v }))} options={LEAD_STATUSES.map((s) => ({ value: s, label: s }))} />
        <Input label="Score (0-100)" type="number" value={form.score} onChange={set('score')} />
        <Input label="Estimated value (₹)" type="number" value={form.estimatedValue} onChange={set('estimatedValue')} />
        <Input label="Expected close date" type="date" value={form.expectedCloseDate} onChange={set('expectedCloseDate')} />
        <Input label="Tags" value={form.tags} onChange={set('tags')} />
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