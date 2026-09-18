import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Search, Users, Phone, Building2, Tag as TagIcon, Star, Pencil, Trash2, ArrowLeft, MessageSquareText, Mail, MapPin } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { api, ApiError } from '@/lib/api';
import { Avatar, Badge, Input, Select, EmptyState, Skeleton } from '@/components/base';
import { toast, Button } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/overlay';
import { formatDateTime, timeAgo } from '@/lib/format';

interface ContactRow {
  id: string; name: string; phone: string; email?: string | null; company?: string | null; location?: string | null;
  avatarUrl?: string | null; leadStatus: string; leadScore: number; customerType: string; source: string;
  assignedTo?: { id: string; name: string; avatarUrl?: string | null } | null;
  tags: Array<{ id: string; name: string; color: string }>;
  lastActivityAt?: string | null; createdAt: string;
  _count?: { conversations: number; deals: number };
}

export function ContactsPage() {
  const ws = useAuth((s) => s.currentWorkspaceId);
  const navigate = useNavigate();
  const [items, setItems] = React.useState<ContactRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [leadStatus, setLeadStatus] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [showCreate, setShowCreate] = React.useState(false);
  const pageSize = 25;

  const load = React.useCallback(async () => {
    if (!ws) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set('search', search);
      if (leadStatus) params.set('leadStatus', leadStatus);
      const res = await api.get<{ items: ContactRow[]; total: number }>(`/api/workspaces/${ws}/contacts?${params}`);
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [ws, page, search, leadStatus]);

  React.useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-ink-200 px-5 py-3">
        <div>
          <h1 className="text-lg font-bold text-ink-900">Contacts</h1>
          <p className="text-xs text-ink-500">{total} contacts in this workspace</p>
        </div>
        <Button onClick={() => setShowCreate(true)} icon={<Plus className="h-4 w-4" />}>Add contact</Button>
      </div>

      <div className="flex items-center gap-2 border-b border-ink-100 px-5 py-3">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, phone, email…" className="h-9 w-full rounded-lg border border-ink-200 bg-ink-50 pl-9 pr-3 text-[13px] focus:border-whatsapp-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-whatsapp-100" />
        </div>
        <Select
          value={leadStatus}
          onChange={(v) => { setLeadStatus(v); setPage(1); }}
          placeholder="All statuses"
          className="w-44"
          options={['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted', 'Lost'].map((s) => ({ value: s, label: s }))}
        />
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-ink-100 p-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-40" /><Skeleton className="h-3 w-24" /></div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Users className="h-5 w-5" />} title="No contacts found" description="Try adjusting your search or filters." action={<Button size="sm" onClick={() => setShowCreate(true)}>Add your first contact</Button>} />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-ink-50/95 text-[11px] uppercase tracking-wide text-ink-500 backdrop-blur">
              <tr>
                <th className="px-5 py-2.5 font-medium">Contact</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Score</th>
                <th className="px-3 py-2.5 font-medium">Company</th>
                <th className="px-3 py-2.5 font-medium">Tags</th>
                <th className="px-3 py-2.5 font-medium">Owner</th>
                <th className="px-3 py-2.5 font-medium">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/contacts/${c.id}`)} className="cursor-pointer border-t border-ink-100 hover:bg-whatsapp-50/40">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} url={c.avatarUrl} size="sm" />
                      <div>
                        <div className="font-medium text-ink-900">{c.name}</div>
                        <div className="flex items-center gap-2 text-xs text-ink-500">
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>
                          {c._count ? <span className="flex items-center gap-1"><MessageSquareText className="h-3 w-3" />{c._count.conversations}</span> : null}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3"><Badge label={c.leadStatus} /></td>
                  <td className="px-3 py-3 font-semibold text-ink-800">{c.leadScore}</td>
                  <td className="px-3 py-3 text-ink-600">{c.company || '—'}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.slice(0, 3).map((t) => <Badge key={t.id} label={t.name} />)}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-ink-600">{c.assignedTo?.name ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-ink-500">{timeAgo(c.lastActivityAt ?? c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > pageSize && (
        <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3 text-[13px] text-ink-600">
          <span>Page {page} of {Math.ceil(total / pageSize)}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="secondary" size="sm" disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {showCreate && <CreateContactModal onClose={() => setShowCreate(false)} onCreated={(c) => navigate(`/contacts/${c.id}`)} />}
    </div>
  );
}

function CreateContactModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: { id: string }) => void }) {
  const ws = useAuth((s) => s.currentWorkspaceId);
  const [form, setForm] = React.useState({ name: '', phone: '', email: '', company: '', location: '', leadStatus: 'New', customerType: 'Lead', tags: '' });
  const [loading, setLoading] = React.useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!ws) return;
    setLoading(true);
    try {
      const c = await api.post<ContactRow>(`/api/workspaces/${ws}/contacts`, {
        ...form,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      toast.success('Contact created');
      onCreated(c);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create contact');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Add contact" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} loading={loading} disabled={!form.name || !form.phone}>Create contact</Button>
      </>
    }>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Full name *" value={form.name} onChange={set('name')} placeholder="Priya Patel" />
        <Input label="Phone *" value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" />
        <Input label="Email" value={form.email} onChange={set('email')} placeholder="priya@example.com" />
        <Input label="Company" value={form.company} onChange={set('company')} placeholder="Acme Corp" />
        <Input label="Location" value={form.location} onChange={set('location')} placeholder="Mumbai" />
        <Select value={form.leadStatus} onChange={(v) => setForm((f) => ({ ...f, leadStatus: v }))} options={['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted', 'Lost'].map((s) => ({ value: s, label: s }))} className="mt-6" />
        <Input label="Tags (comma separated)" value={form.tags} onChange={set('tags')} placeholder="VIP, hot lead" className="col-span-2" />
      </div>
    </Modal>
  );
}

// ---------------- Contact Detail ----------------

interface ContactDetail extends ContactRow {
  notes: Array<{ id: string; body: string; createdAt: string; author?: { name: string } | null }>;
  conversations: any[];
  leads: any[];
  deals: any[];
  orders: any[];
  tasks: any[];
  activities: Array<{ id: string; type: string; title: string; createdAt: string; actor?: { name: string } | null }>;
}

export function ContactDetailPage() {
  const { contactId } = useParams();
  const ws = useAuth((s) => s.currentWorkspaceId);
  const navigate = useNavigate();
  const [contact, setContact] = React.useState<ContactDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [note, setNote] = React.useState('');

  const load = React.useCallback(async () => {
    if (!ws || !contactId) return;
    setLoading(true);
    try {
      setContact(await api.get<ContactDetail>(`/api/workspaces/${ws}/contacts/${contactId}`));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load contact');
    } finally {
      setLoading(false);
    }
  }, [ws, contactId]);

  React.useEffect(() => { load(); }, [load]);

  const addNote = async () => {
    if (!ws || !note.trim()) return;
    try {
      await api.patch(`/api/workspaces/${ws}/contacts/${contactId}`, { notes: note.trim() });
      setNote('');
      await load();
      toast.success('Note added');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to add note');
    }
  };

  const remove = async () => {
    if (!ws) return;
    try {
      await api.delete(`/api/workspaces/${ws}/contacts/${contactId}`);
      toast.success('Contact deleted');
      navigate('/contacts');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed');
    }
  };

  if (loading || !contact) {
    return <div className="flex h-full items-center justify-center"><Skeleton className="h-40 w-96" /></div>;
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-ink-50">
      <div className="flex items-center gap-3 border-b border-ink-200 bg-white px-5 py-3">
        <button onClick={() => navigate('/contacts')} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"><ArrowLeft className="h-4 w-4" /></button>
        <Avatar name={contact.name} url={contact.avatarUrl} size="md" />
        <div className="flex-1">
          <h1 className="text-base font-bold text-ink-900">{contact.name}</h1>
          <p className="text-xs text-ink-500">Contact since {formatDateTime(contact.createdAt)}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {contact.leads?.length === 0 && (
            <Button variant="secondary" size="sm" icon={<Star className="h-3.5 w-3.5" />} onClick={() => navigate('/leads')}>Convert to lead</Button>
          )}
          <Button variant="secondary" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(true)}>Edit</Button>
          <Button variant="ghost" size="sm" icon={<Trash2 className="h-3.5 w-3.5 text-red-600" />} onClick={() => setConfirmDelete(true)} />
        </div>
      </div>

      <div className="flex-1 p-5">
        <div className="grid grid-cols-3 gap-4">
          {/* Left column */}
          <div className="space-y-4">
            <Card title="Details">
              <div className="space-y-2 text-[13px]">
                <DetailRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={contact.phone} />
                {contact.email && <DetailRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={contact.email} />}
                {contact.company && <DetailRow icon={<Building2 className="h-3.5 w-3.5" />} label="Company" value={contact.company} />}
                {contact.location && <DetailRow icon={<MapPin className="h-3.5 w-3.5" />} label="Location" value={contact.location} />}
                <DetailRow icon={<TagIcon className="h-3.5 w-3.5" />} label="Source" value={contact.source} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {contact.tags.map((t) => <Badge key={t.id} label={t.name} />)}
                {contact.tags.length === 0 && <span className="text-xs text-ink-400">No tags</span>}
              </div>
              <div className="mt-3 flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2">
                <span className="text-xs font-medium text-ink-500">Lead score</span>
                <span className="text-sm font-bold text-whatsapp-600">{contact.leadScore}/100</span>
              </div>
            </Card>

            <Card title="Notes">
              <div className="mb-2 flex gap-2">
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" className="h-9 flex-1 rounded-lg border border-ink-200 px-3 text-[13px] focus:border-whatsapp-400 focus:outline-none" />
                <Button size="sm" onClick={addNote}>Add</Button>
              </div>
              <div className="space-y-2">
                {contact.notes.slice(0, 5).map((n) => (
                  <div key={n.id} className="rounded-lg border border-ink-100 bg-white p-2.5">
                    <p className="whitespace-pre-wrap text-[13px] text-ink-800">{n.body}</p>
                    <div className="mt-1 text-[11px] text-ink-400">{n.author?.name ?? 'Team'} · {timeAgo(n.createdAt)}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Middle column */}
          <div className="space-y-4">
            <Card title={`Conversations (${contact.conversations.length})`}>
              <div className="space-y-2">
                {contact.conversations.slice(0, 5).map((c) => (
                  <button key={c.id} onClick={() => navigate(`/inbox/${c.id}`)} className="flex w-full items-center justify-between rounded-lg border border-ink-100 px-3 py-2 text-left hover:bg-ink-50">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-ink-900">{c.lastMessageText || 'Conversation'}</div>
                      <div className="text-[11px] text-ink-400">{timeAgo(c.lastMessageAt)} · {c._count?.messages ?? 0} messages</div>
                    </div>
                    <Badge label={c.status} />
                  </button>
                ))}
                {contact.conversations.length === 0 && <p className="text-xs text-ink-400">No conversations yet</p>}
              </div>
            </Card>

            <Card title={`Deals (${contact.deals.length})`}>
              <div className="space-y-2">
                {contact.deals.map((d) => (
                  <button key={d.id} onClick={() => navigate(`/deals/${d.id}`)} className="flex w-full items-center justify-between rounded-lg border border-ink-100 px-3 py-2 text-left hover:bg-ink-50">
                    <div>
                      <div className="text-[13px] font-medium text-ink-900">{d.name}</div>
                      <div className="text-[11px] text-ink-400">{d.stage}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] font-bold text-ink-900">₹{Number(d.value).toLocaleString('en-IN')}</div>
                      <Badge label={d.stage} />
                    </div>
                  </button>
                ))}
                {contact.deals.length === 0 && <p className="text-xs text-ink-400">No deals yet</p>}
              </div>
            </Card>

            <Card title={`Tasks (${contact.tasks.length})`}>
              <div className="space-y-1.5">
                {contact.tasks.slice(0, 5).map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2">
                    <span className="text-[13px] text-ink-800">{t.title}</span>
                    <Badge label={t.status} />
                  </div>
                ))}
                {contact.tasks.length === 0 && <p className="text-xs text-ink-400">No tasks yet</p>}
              </div>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <Card title="Leads">
              <div className="space-y-2">
                {contact.leads.map((l) => (
                  <button key={l.id} onClick={() => navigate(`/leads/${l.id}`)} className="flex w-full items-center justify-between rounded-lg border border-ink-100 px-3 py-2 text-left hover:bg-ink-50">
                    <div>
                      <div className="text-[13px] font-medium text-ink-900">{l.name}</div>
                      <div className="text-[11px] text-ink-400">{l.source}</div>
                    </div>
                    <Badge label={l.status} />
                  </button>
                ))}
                {contact.leads.length === 0 && <p className="text-xs text-ink-400">No leads yet</p>}
              </div>
            </Card>

            <Card title="Activity timeline">
              <div className="relative ml-2 space-y-3 border-l border-ink-200 pl-4">
                {contact.activities.map((a) => (
                  <div key={a.id} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-whatsapp-400" />
                    <div className="text-[13px] font-medium text-ink-800">{a.title}</div>
                    <div className="text-[11px] text-ink-400">{a.actor?.name ? `by ${a.actor.name} · ` : ''}{timeAgo(a.createdAt)}</div>
                  </div>
                ))}
                {contact.activities.length === 0 && <p className="text-xs text-ink-400">No activity yet</p>}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {editing && (
        <EditContactModal
          contact={contact}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load(); }}
        />
      )}
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={remove} title="Delete contact" message={`Delete ${contact.name} and all their data? This cannot be undone.`} confirmLabel="Delete" />
    </div>
  );
}

function EditContactModal({ contact, onClose, onSaved }: { contact: ContactDetail; onClose: () => void; onSaved: () => void }) {
  const ws = useAuth((s) => s.currentWorkspaceId);
  const [form, setForm] = React.useState({ name: contact.name, phone: contact.phone, email: contact.email ?? '', company: contact.company ?? '', location: contact.location ?? '', customerType: contact.customerType });
  const [loading, setLoading] = React.useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!ws) return;
    setLoading(true);
    try {
      await api.patch(`/api/workspaces/${ws}/contacts/${contact.id}`, form);
      toast.success('Contact updated');
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Edit contact" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} loading={loading}>Save changes</Button>
      </>
    }>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Full name" value={form.name} onChange={set('name')} />
        <Input label="Phone" value={form.phone} onChange={set('phone')} />
        <Input label="Email" value={form.email} onChange={set('email')} />
        <Input label="Company" value={form.company} onChange={set('company')} />
        <Input label="Location" value={form.location} onChange={set('location')} />
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