import React from 'react';
import { Plus, Zap, Trash2, Power, Play, History } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { api, ApiError } from '@/lib/api';
import { Badge, EmptyState, Input, Select, Skeleton } from '@/components/base';
import { toast, Button } from '@/components/ui';
import { Modal, ConfirmDialog, Drawer } from '@/components/overlay';
import { timeAgo } from '@/lib/format';

const TRIGGER_LABELS: Record<string, string> = {
  new_conversation: 'New conversation starts',
  new_message: 'Customer sends a message',
  contact_created: 'Contact is created',
  lead_created: 'New lead is created',
  lead_status_changed: 'Lead status changes',
  deal_created: 'Deal is created',
  deal_stage_changed: 'Deal stage changes',
  no_response: 'Customer stops responding',
  task_overdue: 'Task becomes overdue',
};

const ACTION_LABELS: Record<string, string> = {
  assign_user: 'Assign to user',
  add_tag: 'Add tag',
  remove_tag: 'Remove tag',
  create_task: 'Create follow-up task',
  send_template: 'Send message template',
  update_status: 'Update status',
  notify: 'Notify team member',
  auto_reply: 'Send auto-reply',
};

interface Automation {
  id: string; name: string; description?: string | null; triggerType: string;
  conditions: Array<{ field: string; op: string; value: any }>; actions: Array<{ type: string; value: any }>;
  isEnabled: boolean; createdAt: string;
  _count?: { runs: number };
}

export function AutomationsPage() {
  const ws = useAuth((s) => s.currentWorkspaceId);
  const [items, setItems] = React.useState<Automation[]>([]);
  const [triggers, setTriggers] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showCreate, setShowCreate] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Automation | null>(null);
  const [runsFor, setRunsFor] = React.useState<Automation | null>(null);

  const load = React.useCallback(async () => {
    if (!ws) return;
    setLoading(true);
    try {
      const res = await api.get<{ items: Automation[]; triggers: string[] }>(`/api/workspaces/${ws}/automations`);
      setItems(res.items);
      setTriggers(res.triggers);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load automations');
    } finally {
      setLoading(false);
    }
  }, [ws]);

  React.useEffect(() => { load(); }, [load]);

  const toggle = async (a: Automation) => {
    if (!ws) return;
    try {
      await api.patch(`/api/workspaces/${ws}/automations/${a.id}`, { isEnabled: !a.isEnabled });
      load();
      toast.success(a.isEnabled ? 'Automation disabled' : 'Automation enabled');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Toggle failed');
    }
  };

  const remove = async () => {
    if (!ws || !deleting) return;
    try {
      await api.delete(`/api/workspaces/${ws}/automations/${deleting.id}`);
      toast.success('Automation deleted');
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
          <h1 className="text-lg font-bold text-ink-900">Automations</h1>
          <p className="text-xs text-ink-500">Automate follow-ups, tagging, assignments and responses</p>
        </div>
        <Button onClick={() => setShowCreate(true)} icon={<Plus className="h-4 w-4" />}>New automation</Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Zap className="h-5 w-5" />} title="No automations yet" description="Create rules so your team never misses a follow-up again." action={<Button size="sm" onClick={() => setShowCreate(true)}>Create your first automation</Button>} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((a) => (
              <div key={a.id} className="rounded-xl border border-ink-100 bg-white p-4 shadow-card">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${a.isEnabled ? 'bg-whatsapp-50 text-whatsapp-600' : 'bg-ink-100 text-ink-400'}`}><Zap className="h-4 w-4" /></span>
                    <div>
                      <div className="text-sm font-semibold text-ink-900">{a.name}</div>
                      <div className="text-[11px] text-ink-400">Created {timeAgo(a.createdAt)} · {a._count?.runs ?? 0} runs</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge label={a.isEnabled ? 'Enabled' : 'Disabled'} color={a.isEnabled ? 'green' : 'gray'} />
                    <button onClick={() => toggle(a)} className={`rounded-md p-1.5 ${a.isEnabled ? 'text-amber-500 hover:bg-amber-50' : 'text-ink-300 hover:bg-ink-100'}`}><Power className="h-4 w-4" /></button>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  <div className="flex items-start gap-2 text-[13px]">
                    <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-500">When</span>
                    <span className="text-ink-800">{TRIGGER_LABELS[a.triggerType] ?? a.triggerType}</span>
                  </div>
                  {a.conditions.length > 0 && (
                    <div className="flex items-start gap-2 text-[12px]">
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-600">If</span>
                      <div className="space-y-0.5 text-ink-600">
                        {a.conditions.map((c, i) => (
                          <div key={i}>{c.field} {c.op} <span className="font-medium text-ink-800">{String(c.value)}</span></div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2 text-[12px]">
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-600">Then</span>
                    <div className="space-y-0.5 text-ink-600">
                      {a.actions.map((ac, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className="font-medium text-ink-800">{ACTION_LABELS[ac.type] ?? ac.type}</span>
                          {ac.value ? <span className="text-ink-500">({formatActionValue(ac)})</span> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-end gap-1 border-t border-ink-100 pt-2">
                  <Button variant="ghost" size="xs" icon={<History className="h-3.5 w-3.5" />} onClick={() => setRunsFor(a)}>Runs</Button>
                  <Button variant="ghost" size="xs" icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />} onClick={() => setDeleting(a)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && <AutomationModal triggers={triggers} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} title="Delete automation" message={`Delete "${deleting?.name}"? This cannot be undone.`} confirmLabel="Delete" />
      <RunsDrawer automation={runsFor} onClose={() => setRunsFor(null)} />
    </div>
  );
}

function formatActionValue(a: { type: string; value: any }): string {
  if (typeof a.value === 'string' || typeof a.value === 'number') return String(a.value);
  if (a.value && typeof a.value === 'object') return Object.values(a.value).filter((v) => v !== undefined && v !== '').join(', ');
  return '';
}

function AutomationModal({ triggers, onClose, onSaved }: { triggers: string[]; onClose: () => void; onSaved: () => void }) {
  const ws = useAuth((s) => s.currentWorkspaceId);
  const [name, setName] = React.useState('');
  const [triggerType, setTriggerType] = React.useState('lead_status_changed');
  const [condition, setCondition] = React.useState({ field: 'status', op: 'equals', value: '' });
  const [hasCondition, setHasCondition] = React.useState(false);
  const [actionType, setActionType] = React.useState('add_tag');
  const [actionValue, setActionValue] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const submit = async () => {
    if (!ws || !name) return;
    setLoading(true);
    try {
      await api.post(`/api/workspaces/${ws}/automations`, {
        name,
        triggerType,
        conditions: hasCondition ? [condition] : [],
        actions: [{ type: actionType, value: actionValue }],
        isEnabled: true,
      });
      toast.success('Automation created');
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create automation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New automation" size="lg" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} loading={loading} disabled={!name}>Create automation</Button>
      </>
    }>
      <div className="space-y-3">
        <Input label="Automation name *" value={name} onChange={(e) => setName(e.target.value)} placeholder="Follow up on qualified leads" />
        <div>
          <span className="mb-1 block text-[13px] font-medium text-ink-700">Trigger</span>
          <Select value={triggerType} onChange={setTriggerType} options={triggers.map((t) => ({ value: t, label: TRIGGER_LABELS[t] ?? t }))} />
        </div>

        <div className="rounded-lg border border-ink-100 bg-ink-50/50 p-3">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink-700">
            <input type="checkbox" checked={hasCondition} onChange={(e) => setHasCondition(e.target.checked)} className="h-4 w-4 accent-whatsapp-500" />
            Add a condition
          </label>
          {hasCondition && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Input value={condition.field} onChange={(e) => setCondition((c) => ({ ...c, field: e.target.value }))} placeholder="field (e.g. status)" />
              <Select value={condition.op} onChange={(v) => setCondition((c) => ({ ...c, op: v }))} options={['equals', 'not_equals', 'contains', 'greater_than', 'less_than'].map((o) => ({ value: o, label: o }))} />
              <Input value={condition.value} onChange={(e) => setCondition((c) => ({ ...c, value: e.target.value }))} placeholder="value" />
            </div>
          )}
        </div>

        <div className="rounded-lg border border-ink-100 bg-ink-50/50 p-3">
          <span className="mb-2 block text-[13px] font-medium text-ink-700">Action</span>
          <div className="grid grid-cols-2 gap-2">
            <Select value={actionType} onChange={setActionType} options={Object.keys(ACTION_LABELS).map((a) => ({ value: a, label: ACTION_LABELS[a] }))} />
            <Input value={actionValue} onChange={(e) => setActionValue(e.target.value)} placeholder="Value (tag name, template, user…)" />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function RunsDrawer({ automation, onClose }: { automation: Automation | null; onClose: () => void }) {
  const ws = useAuth((s) => s.currentWorkspaceId);
  const [runs, setRuns] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!automation || !ws) return;
    setLoading(true);
    api.get<{ items: any[] }>(`/api/workspaces/${ws}/automations/${automation.id}/runs`)
      .then((r) => setRuns(r.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [automation, ws]);

  return (
    <Drawer open={!!automation} onClose={onClose} title={automation ? `Runs · ${automation.name}` : 'Runs'} width="w-[440px]">
      <div className="p-4">
        {loading ? <Skeleton className="h-40" /> : runs.length === 0 ? (
          <EmptyState icon={<Play className="h-5 w-5" />} title="No runs yet" description="This automation hasn't triggered yet." />
        ) : (
          <div className="space-y-2">
            {runs.map((r) => (
              <div key={r.id} className="rounded-lg border border-ink-100 p-3">
                <div className="flex items-center justify-between">
                  <Badge label={r.status} color={r.status === 'success' ? 'green' : r.status === 'failed' ? 'red' : 'blue'} />
                  <span className="text-[11px] text-ink-400">{timeAgo(r.createdAt)}</span>
                </div>
                {r.error && <p className="mt-1.5 text-xs text-red-600">{r.error}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}