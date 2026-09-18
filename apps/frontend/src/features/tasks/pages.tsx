import React from 'react';
import { Plus, Search, CheckCircle2, Circle, CalendarClock } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { api, ApiError } from '@/lib/api';
import { Badge, EmptyState, Select, Input, Skeleton, Tabs } from '@/components/base';
import { toast, Button } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/overlay';
import { formatDateTime, timeAgo } from '@/lib/format';

const PRIORITIES = ['urgent', 'high', 'medium', 'low'];

interface Task {
  id: string; title: string; description?: string | null; type: string; priority: string; status: string;
  dueDate?: string | null; recurring?: string | null;
  contact?: { id: string; name: string; phone: string } | null;
  deal?: { id: string; name: string; value: number; stage: string } | null;
  assignedTo?: { id: string; name: string; avatarUrl?: string | null } | null;
  createdAt: string;
}

export function TasksPage() {
  const ws = useAuth((s) => s.currentWorkspaceId);
  const [items, setItems] = React.useState<Task[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState('pending');
  const [search, setSearch] = React.useState('');
  const [priority, setPriority] = React.useState('');
  const [showCreate, setShowCreate] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Task | null>(null);

  const load = React.useCallback(async () => {
    if (!ws) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab) params.set('status', tab);
      if (priority) params.set('priority', priority);
      if (search) params.set('search', search);
      const res = await api.get<{ items: Task[] }>(`/api/workspaces/${ws}/tasks?${params}`);
      setItems(res.items);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [ws, tab, priority, search]);

  React.useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const toggle = async (t: Task) => {
    if (!ws) return;
    const next = t.status === 'completed' ? 'pending' : 'completed';
    try {
      await api.patch(`/api/workspaces/${ws}/tasks/${t.id}`, { status: next });
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed');
    }
  };

  const remove = async () => {
    if (!ws || !deleting) return;
    try {
      await api.delete(`/api/workspaces/${ws}/tasks/${deleting.id}`);
      toast.success('Task deleted');
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed');
    }
  };

  const counts = {
    pending: items.filter((t) => t.status === 'pending').length,
    completed: items.filter((t) => t.status === 'completed').length,
    overdue: items.filter((t) => t.status === 'pending' && t.dueDate && new Date(t.dueDate) < new Date()).length,
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-ink-200 px-5 py-3">
        <div>
          <h1 className="text-lg font-bold text-ink-900">Tasks & Follow-ups</h1>
          <p className="text-xs text-ink-500">Track follow-ups, reminders and recurring check-ins</p>
        </div>
        <Button onClick={() => setShowCreate(true)} icon={<Plus className="h-4 w-4" />}>New task</Button>
      </div>

      <div className="flex items-center gap-3 border-b border-ink-100 px-5 py-3">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'pending', label: 'Pending', count: counts.pending },
            { value: 'completed', label: 'Completed', count: counts.completed },
          ]}
        />
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks…" className="h-8 w-56 rounded-lg border border-ink-200 bg-ink-50 pl-8 pr-3 text-[13px] focus:border-whatsapp-400 focus:bg-white focus:outline-none" />
          </div>
          <Select value={priority} onChange={setPriority} placeholder="Priority" className="w-32" options={PRIORITIES.map((p) => ({ value: p, label: p }))} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="No tasks found" description="Create a task or adjust your filters." action={<Button size="sm" onClick={() => setShowCreate(true)}>New task</Button>} />
        ) : (
          <div className="space-y-2">
            {items.map((t) => (
              <div key={t.id} className="flex items-start gap-3 rounded-xl border border-ink-100 bg-white p-3.5 shadow-card transition-shadow hover:shadow-pop">
                <button onClick={() => toggle(t)} className="mt-0.5 shrink-0" title={t.status === 'completed' ? 'Mark pending' : 'Mark complete'}>
                  {t.status === 'completed' ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-ink-300 hover:text-whatsapp-500" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-medium ${t.status === 'completed' ? 'text-ink-400 line-through' : 'text-ink-900'}`}>{t.title}</span>
                    <PriorityBadge priority={t.priority} />
                    {t.type && <Badge label={t.type.replace('_', ' ')} color="gray" />}
                    {t.recurring && <Badge label={`🔁 ${t.recurring}`} color="cyan" />}
                  </div>
                  {t.description && <p className="mt-0.5 line-clamp-1 text-xs text-ink-500">{t.description}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-ink-500">
                    {t.dueDate && (
                      <span className={`flex items-center gap-1 ${isOverdue(t) ? 'font-semibold text-red-600' : ''}`}>
                        <CalendarClock className="h-3 w-3" /> {formatDateTime(t.dueDate)} {isOverdue(t) && '(overdue)'}
                      </span>
                    )}
                    {t.contact && <span>👤 {t.contact.name}</span>}
                    {t.deal && <span>💰 {t.deal.name}</span>}
                    {t.assignedTo && <span>· {t.assignedTo.name}</span>}
                  </div>
                </div>
                <button onClick={() => setDeleting(t)} className="rounded-md p-1 text-ink-300 hover:bg-red-50 hover:text-red-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} title="Delete task" message={`Delete "${deleting?.title}"?`} confirmLabel="Delete" />
    </div>
  );
}

function isOverdue(t: Task): boolean {
  return t.status === 'pending' && !!t.dueDate && new Date(t.dueDate) < new Date();
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, { label: string; cls: string; icon: string }> = {
    urgent: { label: 'Urgent', cls: 'bg-red-50 text-red-700 border-red-200', icon: 'bg-red-500' },
    high: { label: 'High', cls: 'bg-orange-50 text-orange-700 border-orange-200', icon: 'bg-orange-500' },
    medium: { label: 'Medium', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'bg-amber-500' },
    low: { label: 'Low', cls: 'bg-ink-50 text-ink-600 border-ink-200', icon: 'bg-ink-400' },
  };
  const c = colors[priority] ?? colors.medium;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${c.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.icon}`} /> {c.label}
    </span>
  );
}

function CreateTaskModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const ws = useAuth((s) => s.currentWorkspaceId);
  const [contacts, setContacts] = React.useState<any[]>([]);
  const [members, setMembers] = React.useState<any[]>([]);
  const [form, setForm] = React.useState({ title: '', description: '', type: 'follow_up', priority: 'medium', dueDate: '', recurring: '', assignedToId: '', contactId: '' });
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!ws) return;
    api.get<{ items: any[] }>(`/api/workspaces/${ws}/contacts?pageSize=100`).then((r) => setContacts(r.items)).catch(() => {});
    api.get<{ items: any[] }>(`/api/workspaces/${ws}/team`).then((r) => setMembers(r.items)).catch(() => {});
  }, [ws]);

  const submit = async () => {
    if (!ws) return;
    setLoading(true);
    try {
      await api.post(`/api/workspaces/${ws}/tasks`, {
        ...form,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
        assignedToId: form.assignedToId || undefined,
        contactId: form.contactId || undefined,
        recurring: form.recurring || undefined,
      });
      toast.success('Task created');
      onCreated();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New task" size="lg" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} loading={loading} disabled={!form.title}>Create task</Button>
      </>
    }>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Title *" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="col-span-2" />
        <Input label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="col-span-2" />
        <Select value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))} options={['follow_up', 'call', 'meeting', 'email', 'reminder', 'other'].map((t) => ({ value: t, label: t.replace('_', ' ') }))} />
        <Select value={form.priority} onChange={(v) => setForm((f) => ({ ...f, priority: v }))} options={PRIORITIES.map((p) => ({ value: p, label: p }))} />
        <Input label="Due date" type="datetime-local" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
        <Select value={form.recurring} onChange={(v) => setForm((f) => ({ ...f, recurring: v }))} options={['', 'daily', 'weekly', 'monthly'].map((r) => ({ value: r, label: r || 'No recurrence' }))} />
        <Select value={form.assignedToId} onChange={(v) => setForm((f) => ({ ...f, assignedToId: v }))} options={members.map((m) => ({ value: m.userId, label: m.user.name }))} placeholder="Assign to…" />
        <Select value={form.contactId} onChange={(v) => setForm((f) => ({ ...f, contactId: v }))} options={contacts.map((c) => ({ value: c.id, label: c.name }))} placeholder="Linked contact…" />
      </div>
    </Modal>
  );
}