import React from 'react';
import { Save, MessageCircle, Plug, Zap, Copy, Check, RotateCcw, Building2, Globe } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { api, ApiError } from '@/lib/api';
import { Input, TextArea, Tabs, Skeleton, Badge } from '@/components/base';
import { toast, Button } from '@/components/ui';
import { formatCurrency } from '@/lib/format';

export function SettingsPage() {
  const ws = useAuth((s) => s.currentWorkspaceId);
  const [tab, setTab] = React.useState('general');
  const [loading, setLoading] = React.useState(true);

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-ink-200 px-5 py-3">
        <h1 className="text-lg font-bold text-ink-900">Settings</h1>
        <p className="text-xs text-ink-500">Workspace, WhatsApp connection and preferences</p>
      </div>
      <div className="border-b border-ink-100 px-5 py-2.5">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'general', label: 'General' },
            { value: 'whatsapp', label: 'WhatsApp' },
            { value: 'auto-reply', label: 'Auto-reply' },
          ]}
        />
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-24" /></div>
        ) : tab === 'general' ? (
          <GeneralSettings onLoaded={() => setLoading(false)} />
        ) : tab === 'whatsapp' ? (
          <WhatsAppSettings onLoaded={() => setLoading(false)} />
        ) : (
          <AutoReplySettings onLoaded={() => setLoading(false)} />
        )}
      </div>
    </div>
  );
}

function GeneralSettings({ onLoaded }: { onLoaded: () => void }) {
  const ws = useAuth((s) => s.currentWorkspaceId);
  const setWorkspaces = useAuth((s) => s.setWorkspaces);
  const [form, setForm] = React.useState({ name: '', companyName: '', timezone: 'Asia/Kolkata', currency: 'INR', replySignature: '' });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!ws) return;
    api.get<{ workspace: any; settings: any }>(`/api/workspaces/${ws}`)
      .then((r) => {
        setForm({
          name: r.workspace.name,
          companyName: r.workspace.companyName ?? '',
          timezone: r.workspace.timezone ?? 'Asia/Kolkata',
          currency: r.workspace.currency ?? 'INR',
          replySignature: r.settings.replySignature ?? '',
        });
      })
      .catch((e) => toast.error(e instanceof ApiError ? e.message : 'Failed to load settings'))
      .finally(() => { setLoading(false); onLoaded(); });
  }, [ws, onLoaded]);

  const save = async () => {
    if (!ws) return;
    setSaving(true);
    try {
      const res = await api.patch<{ workspace: any; settings: any }>(`/api/workspaces/${ws}`, form);
      toast.success('Settings saved');
      const list = await api.get<{ workspaces: any[] }>(`/api/workspaces`);
      setWorkspaces(list.workspaces);
      const cw = list.workspaces.find((w) => w.id === ws);
      if (cw) useAuth.setState({ currentWorkspaceId: cw.id });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div className="max-w-2xl space-y-4">
      <Section icon={<Building2 className="h-4 w-4" />} title="Workspace">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Workspace name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Company name" value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} />
          <Input label="Timezone" value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} />
          <Input label="Currency" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))} maxLength={3} />
        </div>
        <p className="text-[11px] text-ink-400">Currency affects all deal values. Example: {formatCurrency(250000, form.currency)}</p>
      </Section>

      <Section icon={<Globe className="h-4 w-4" />} title="Reply signature">
        <TextArea rows={2} value={form.replySignature} onChange={(e) => setForm((f) => ({ ...f, replySignature: e.target.value }))} placeholder="— Thanks, the Acme team" />
        <p className="mt-1 text-[11px] text-ink-400">Appended to outbound agent messages.</p>
      </Section>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving} icon={<Save className="h-4 w-4" />}>Save settings</Button>
      </div>
    </div>
  );
}

function WhatsAppSettings({ onLoaded }: { onLoaded: () => void }) {
  const ws = useAuth((s) => s.currentWorkspaceId);
  const [info, setInfo] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [form, setForm] = React.useState({ businessAccountId: '', phoneNumberId: '', accessToken: '' });
  const [saving, setSaving] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const load = React.useCallback(() => {
    if (!ws) return;
    api.get(`/api/whatsapp/workspaces/${ws}/whatsapp`)
      .then((r) => { setInfo(r); })
      .catch(() => {})
      .finally(() => { setLoading(false); onLoaded(); });
  }, [ws, onLoaded]);

  React.useEffect(() => { load(); }, [load]);

  const configure = async () => {
    if (!ws) return;
    setSaving(true);
    try {
      await api.post(`/api/whatsapp/workspaces/${ws}/whatsapp/configure`, form);
      toast.success('WhatsApp configured');
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Configuration failed');
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    if (!ws) return;
    try {
      await api.post(`/api/whatsapp/workspaces/${ws}/whatsapp/disconnect`);
      toast.success('Disconnected');
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Disconnect failed');
    }
  };

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div className="max-w-2xl space-y-4">
      <Section icon={<Plug className="h-4 w-4" />} title="Connection status">
        <div className="flex items-center gap-3 rounded-lg border border-ink-100 bg-ink-50/50 p-4">
          <span className={`flex h-10 w-10 items-center justify-center rounded-full ${info?.configured ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
            <MessageCircle className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink-900">{info?.configured ? 'Connected' : 'Not connected'}</span>
              <Badge label={info?.provider ?? 'demo'} />
              {info?.isDemo && <Badge label="Demo mode" color="cyan" />}
            </div>
            <p className="text-xs text-ink-500">
              {info?.configured
                ? `Business account ${info.account?.businessAccountId} · phone ${info.account?.phoneNumberId}`
                : 'Connect your Meta Cloud API credentials to go live. Demo mode is active.'}
            </p>
          </div>
        </div>
      </Section>

      <Section icon={<Plug className="h-4 w-4" />} title="Webhook">
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-ink-50 px-3 py-2 text-[12px] text-ink-700">{info?.webhookUrl}</code>
          <Button variant="secondary" size="sm" icon={copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />} onClick={() => {
            navigator.clipboard.writeText(info?.webhookUrl ?? '').then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
          }}>{copied ? 'Copied' : 'Copy'}</Button>
        </div>
        <div className="mt-2 text-[12px] text-ink-500">
          Verify token: <code className="rounded bg-ink-100 px-1.5 py-0.5 font-medium text-ink-700">{info?.verifyToken}</code>
        </div>
      </Section>

      {!info?.configured ? (
        <Section icon={<Plug className="h-4 w-4" />} title="Configure Meta Cloud API">
          <div className="space-y-3">
            <Input label="Business Account ID" value={form.businessAccountId} onChange={(e) => setForm((f) => ({ ...f, businessAccountId: e.target.value }))} placeholder="123456789012345" />
            <Input label="Phone Number ID" value={form.phoneNumberId} onChange={(e) => setForm((f) => ({ ...f, phoneNumberId: e.target.value }))} placeholder="123456789012345" />
            <Input label="Access Token" type="password" value={form.accessToken} onChange={(e) => setForm((f) => ({ ...f, accessToken: e.target.value }))} placeholder="EAAG... (never shown again)" />
            <Button onClick={configure} loading={saving} icon={<Plug className="h-4 w-4" />} disabled={!form.businessAccountId || !form.phoneNumberId || !form.accessToken}>Connect WhatsApp</Button>
          </div>
        </Section>
      ) : (
        <div className="flex justify-end">
          <Button variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={disconnect}>Disconnect</Button>
        </div>
      )}
    </div>
  );
}

function AutoReplySettings({ onLoaded }: { onLoaded: () => void }) {
  const ws = useAuth((s) => s.currentWorkspaceId);
  const [form, setForm] = React.useState({ autoReplyEnabled: false, autoReplyTemplate: '' });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!ws) return;
    api.get<{ settings: any }>(`/api/workspaces/${ws}`)
      .then((r) => setForm({ autoReplyEnabled: r.settings.autoReplyEnabled ?? false, autoReplyTemplate: r.settings.autoReplyTemplate ?? '' }))
      .catch(() => {})
      .finally(() => { setLoading(false); onLoaded(); });
  }, [ws, onLoaded]);

  const save = async () => {
    if (!ws) return;
    setSaving(true);
    try {
      await api.patch(`/api/workspaces/${ws}`, form);
      toast.success('Auto-reply settings saved');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div className="max-w-2xl space-y-4">
      <Section icon={<Zap className="h-4 w-4" />} title="Auto-reply">
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-ink-100 p-4">
          <input type="checkbox" checked={form.autoReplyEnabled} onChange={(e) => setForm((f) => ({ ...f, autoReplyEnabled: e.target.checked }))} className="h-4 w-4 accent-whatsapp-500" />
          <div>
            <div className="text-sm font-medium text-ink-900">Enable auto-reply</div>
            <div className="text-xs text-ink-500">Instantly acknowledge new customer messages when no agent is available.</div>
          </div>
        </label>
        <div className="mt-3">
          <TextArea
            rows={4}
            label="Auto-reply message"
            value={form.autoReplyTemplate}
            onChange={(e) => setForm((f) => ({ ...f, autoReplyTemplate: e.target.value }))}
            placeholder="Hi {{customer_name}}! Thanks for reaching out. One of our agents will get back to you shortly."
            disabled={!form.autoReplyEnabled}
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={save} loading={saving} icon={<Save className="h-4 w-4" />}>Save auto-reply</Button>
        </div>
      </Section>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ink-900">
        <span className="text-whatsapp-600">{icon}</span> {title}
      </div>
      {children}
    </div>
  );
}