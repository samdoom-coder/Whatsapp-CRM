import React from 'react';
import { UserPlus, Trash2, Shield, ShieldCheck, UserCog, User as UserIcon, Users } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { api, ApiError } from '@/lib/api';
import { Avatar, Badge, EmptyState, Input, Select, Skeleton } from '@/components/base';
import { toast, Button } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/overlay';
import { formatCurrency, timeAgo } from '@/lib/format';

const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'AGENT'];
const ROLE_ICONS: Record<string, React.ReactNode> = {
  OWNER: <ShieldCheck className="h-4 w-4" />,
  ADMIN: <Shield className="h-4 w-4" />,
  MANAGER: <UserCog className="h-4 w-4" />,
  AGENT: <UserIcon className="h-4 w-4" />,
};

interface TeamMember {
  id: string; role: string; isActive: boolean; createdAt: string;
  user: { id: string; name: string; email: string; avatarUrl?: string | null; isActive: boolean; lastLoginAt?: string | null };
  performance: { conversations: number; unread: number; messages: number; leads: number; dealsWon: number; revenue: number; conversionRate: number };
}

export function TeamPage() {
  const ws = useAuth((s) => s.currentWorkspaceId);
  const user = useAuth((s) => s.user);
  const [items, setItems] = React.useState<TeamMember[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showInvite, setShowInvite] = React.useState(false);
  const [removing, setRemoving] = React.useState<TeamMember | null>(null);

  const load = React.useCallback(async () => {
    if (!ws) return;
    setLoading(true);
    try {
      const res = await api.get<{ items: TeamMember[] }>(`/api/workspaces/${ws}/team`);
      setItems(res.items);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load team');
    } finally {
      setLoading(false);
    }
  }, [ws]);

  React.useEffect(() => { load(); }, [load]);

  const changeRole = async (m: TeamMember, role: string) => {
    if (!ws) return;
    try {
      await api.patch(`/api/workspaces/${ws}/team/${m.id}/role`, { role });
      toast.success(`${m.user.name} is now ${role}`);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Role update failed');
    }
  };

  const remove = async () => {
    if (!ws || !removing) return;
    try {
      await api.delete(`/api/workspaces/${ws}/team/${removing.id}`);
      toast.success(`${removing.user.name} removed from team`);
      setRemoving(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Remove failed');
    }
  };

  const maxRevenue = Math.max(...items.map((m) => m.performance.revenue), 0);

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-ink-200 px-5 py-3">
        <div>
          <h1 className="text-lg font-bold text-ink-900">Team</h1>
          <p className="text-xs text-ink-500">{items.length} members · manage roles and track performance</p>
        </div>
        <Button onClick={() => setShowInvite(true)} icon={<UserPlus className="h-4 w-4" />}>Invite member</Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Users className="h-5 w-5" />} title="No team members" description="Invite teammates to collaborate on conversations." action={<Button size="sm" onClick={() => setShowInvite(true)}>Invite member</Button>} />
        ) : (
          <div className="space-y-2">
            {items.map((m) => {
              const isMe = m.user.id === user?.id;
              return (
                <div key={m.id} className="rounded-xl border border-ink-100 bg-white p-4 shadow-card">
                  <div className="flex items-center gap-4">
                    <Avatar name={m.user.name} url={m.user.avatarUrl} size="lg" status={m.isActive ? 'online' : undefined} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-ink-900">{m.user.name}</span>
                        {isMe && <Badge label="You" color="blue" />}
                        {!m.isActive && <Badge label="Inactive" color="gray" />}
                      </div>
                      <div className="text-xs text-ink-500">{m.user.email} · joined {timeAgo(m.createdAt)}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className="flex items-center gap-1 rounded bg-ink-50 px-2 py-0.5 text-[11px] text-ink-600">{m.performance.conversations} conversations</span>
                        <span className="flex items-center gap-1 rounded bg-ink-50 px-2 py-0.5 text-[11px] text-ink-600">{m.performance.messages} messages</span>
                        <span className="flex items-center gap-1 rounded bg-ink-50 px-2 py-0.5 text-[11px] text-ink-600">{m.performance.leads} leads</span>
                        <span className="flex items-center gap-1 rounded bg-ink-50 px-2 py-0.5 text-[11px] text-ink-600">{m.performance.dealsWon} deals won</span>
                        <span className="flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{formatCurrency(m.performance.revenue)} revenue</span>
                        <span className="flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">{m.performance.conversionRate}% conv.</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="hidden w-40 lg:block">
                        <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                          <div className="h-full rounded-full bg-whatsapp-500" style={{ width: `${maxRevenue ? (m.performance.revenue / maxRevenue) * 100 : 0}%` }} />
                        </div>
                      </div>
                      <Select
                        value={m.role}
                        onChange={(v) => changeRole(m, v)}
                        className="w-32"
                        options={ROLES.map((r) => ({ value: r, label: r }))}
                      />
                      <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4 text-red-500" />} onClick={() => setRemoving(m)} disabled={isMe} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onInvited={() => { setShowInvite(false); load(); }} />}
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} onConfirm={remove} title="Remove member" message={`Remove ${removing?.user.name} from this workspace?`} confirmLabel="Remove" />
    </div>
  );
}

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const ws = useAuth((s) => s.currentWorkspaceId);
  const [form, setForm] = React.useState({ name: '', email: '', role: 'AGENT', password: '' });
  const [loading, setLoading] = React.useState(false);

  const submit = async () => {
    if (!ws) return;
    setLoading(true);
    try {
      await api.post(`/api/workspaces/${ws}/team`, form);
      toast.success('Team member added');
      onInvited();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Invite failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Invite team member" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} loading={loading} disabled={!form.name || !form.email}>Add member</Button>
      </>
    }>
      <div className="space-y-3">
        <Input label="Full name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <Input label="Email *" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        <div>
          <span className="mb-1 block text-[13px] font-medium text-ink-700">Role</span>
          <Select value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v }))} options={ROLES.map((r) => ({ value: r, label: r }))} />
        </div>
        <Input label="Password (optional — defaults to welcome123)" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
      </div>
    </Modal>
  );
}