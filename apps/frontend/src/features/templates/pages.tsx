import React from 'react';
import { Plus, Search, FileText, Copy, Check, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { api, ApiError } from '@/lib/api';
import { Badge, EmptyState, Input, Select, Skeleton, Tabs, TextArea } from '@/components/base';
import { toast, Button } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/overlay';

interface Template {
  id: string; name: string; category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION'; language: string;
  body: string; status: 'draft' | 'pending' | 'approved' | 'rejected'; variables: string[];
  createdAt: string;
}

export function TemplatesPage() {
  const ws = useAuth((s) => s.currentWorkspaceId);
  const [items, setItems] = React.useState<Template[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [tab, setTab] = React.useState('all');
  const [showCreate, setShowCreate] = React.useState(false);
  const [editing, setEditing] = React.useState<Template | null>(null);
  const [deleting, setDeleting] = React.useState<Template | null>(null);

  const load = React.useCallback(async () => {
    if (!ws) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await api.get<{ items: Template[] }>(`/api/workspaces/${ws}/templates?${params}`);
      setItems(res.items);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [ws, search]);

  React.useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const filtered = tab === 'all' ? items : items.filter((t) => t.status === tab || t.category === tab);

  const remove = async () => {
    if (!ws || !deleting) return;
    try {
      await api.delete(`/api/workspaces/${ws}/templates/${deleting.id}`);
      toast.success('Template deleted');
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-ink-200 px-5 py-3">
        <div>
          <h1 className="text-lg font-bold text-ink-900">Message templates</h1>
          <p className="text-xs text-ink-500">Reusable WhatsApp message templates with variables</p>
        </div>
        <Button onClick={() => setShowCreate(true)} icon={<Plus className="h-4 w-4" />}>New template</Button>
      </div>

      <div className="flex items-center gap-3 border-b border-ink-100 px-5 py-3">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'all', label: 'All' },
            { value: 'approved', label: 'Approved' },
            { value: 'draft', label: 'Draft' },
            { value: 'pending', label: 'Pending' },
            { value: 'MARKETING', label: 'Marketing' },
            { value: 'UTILITY', label: 'Utility' },
          ]}
        />
        <div className="ml-auto relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates…" className="h-8 w-56 rounded-lg border border-ink-200 bg-ink-50 pl-8 pr-3 text-[13px] focus:border-whatsapp-400 focus:bg-white focus:outline-none" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<FileText className="h-5 w-5" />} title="No templates found" description="Create a reusable message template to speed up replies." action={<Button size="sm" onClick={() => setShowCreate(true)}>New template</Button>} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((t) => (
              <div key={t.id} className="rounded-xl border border-ink-100 bg-white p-4 shadow-card">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-whatsapp-50 text-whatsapp-600"><FileText className="h-4 w-4" /></span>
                    <div>
                      <div className="text-sm font-semibold text-ink-900">{t.name}</div>
                      <div className="text-[11px] text-ink-400">{t.category} · {t.language.toUpperCase()}</div>
                    </div>
                  </div>
                  <TemplateStatusBadge status={t.status} />
                </div>
                <p className="mt-3 line-clamp-2 rounded-lg bg-ink-50 p-3 text-[13px] text-ink-700">{t.body}</p>
                {t.variables.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {t.variables.map((v) => <span key={v} className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600">{'{{'}{v}{'}}'}</span>)}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-end gap-1">
                  <CopyButton body={t.body} />
                  <Button variant="ghost" size="xs" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(t)}>Edit</Button>
                  <Button variant="ghost" size="xs" icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />} onClick={() => setDeleting(t)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && <TemplateModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
      {editing && <TemplateModal template={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} title="Delete template" message={`Delete template "${deleting?.name}"?`} confirmLabel="Delete" />
    </div>
  );
}

function CopyButton({ body }: { body: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button variant="ghost" size="xs" icon={copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      onClick={() => {
        navigator.clipboard.writeText(body).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
      }}>
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

function TemplateStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    approved: 'green', draft: 'gray', pending: 'blue', rejected: 'red',
  };
  return <Badge label={status} color={colors[status]} />;
}

function TemplateModal({ template, onClose, onSaved }: { template?: Template; onClose: () => void; onSaved: () => void }) {
  const ws = useAuth((s) => s.currentWorkspaceId);
  const [form, setForm] = React.useState({
    name: template?.name ?? '', category: template?.category ?? 'MARKETING', language: template?.language ?? 'en',
    body: template?.body ?? '', status: template?.status ?? 'approved',
  });
  const [loading, setLoading] = React.useState(false);

  const submit = async () => {
    if (!ws) return;
    setLoading(true);
    try {
      const payload = { ...form };
      if (template) {
        await api.patch(`/api/workspaces/${ws}/templates/${template.id}`, payload);
        toast.success('Template updated');
      } else {
        await api.post(`/api/workspaces/${ws}/templates`, payload);
        toast.success('Template created');
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={template ? 'Edit template' : 'New template'} size="lg" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} loading={loading} disabled={!form.name || !form.body}>Save template</Button>
      </>
    }>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Template name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Order confirmation" />
        <Select value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v as any }))} options={['MARKETING', 'UTILITY', 'AUTHENTICATION'].map((c) => ({ value: c, label: c }))} />
        <Select value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v as any }))} options={['approved', 'draft', 'pending', 'rejected'].map((s) => ({ value: s, label: s }))} />
        <Input label="Language" value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))} placeholder="en" />
        <TextArea label="Message body *" rows={5} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} placeholder={'Hi {{customer_name}},\nYour order has been shipped!'} className="col-span-2" />
      </div>
      <p className="mt-2 text-[11px] text-ink-400">Use variables like {'{{customer_name}}'}, {'{{company_name}}'}, {'{{deal_value}}'} — they'll be auto-detected and replaced when sending.</p>
    </Modal>
  );
}