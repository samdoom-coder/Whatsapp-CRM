import React from 'react';
import { X, Phone, Mail, Building2, MapPin, Plus, Sparkles, StickyNote, CalendarClock, Wallet, MessageSquareText, Tag as TagIcon, Users } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { api, ApiError } from '@/lib/api';
import { Avatar, Badge, Skeleton } from '@/components/base';
import { toast } from '@/components/ui';
import { formatCurrency, formatDateTime, timeAgo } from '@/lib/format';
import type { Conversation } from './pages';

interface FullContact {
  id: string; name: string; phone: string; email?: string | null; company?: string | null; location?: string | null;
  leadStatus: string; leadScore: number; customerType: string; source: string;
  assignedTo?: { id: string; name: string } | null;
  tags: Array<{ id: string; name: string; color: string }>;
  notes: Array<{ id: string; body: string; createdAt: string; author?: { name: string } | null }>;
  deals: any[];
  orders: any[];
  tasks: any[];
  activities: Array<{ id: string; type: string; title: string; createdAt: string; actor?: { name: string } | null }>;
  conversations: any[];
}

export function CustomerPanel({ conversation, open, onClose }: { conversation: Conversation; open: boolean; onClose: () => void }) {
  const [contact, setContact] = React.useState<FullContact | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [aiAnalysis, setAiAnalysis] = React.useState<{ intent: string; confidence: number; temperature: string; recommendedAction: string; summary: string[] } | null>(null);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [availableTags, setAvailableTags] = React.useState<any[]>([]);
  const ws = useAuth((s) => s.currentWorkspaceId);

  const load = React.useCallback(async () => {
    if (!ws || !conversation.contact) return;
    setLoading(true);
    try {
      const [c, tags] = await Promise.all([
        api.get<FullContact>(`/api/workspaces/${ws}/contacts/${conversation.contact.id}`),
        api.get<{ items: any[] }>(`/api/workspaces/${ws}/tags`),
      ]);
      setContact(c);
      setAvailableTags(tags.items);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load customer');
    } finally {
      setLoading(false);
    }
  }, [ws, conversation.contact?.id]);

  React.useEffect(() => {
    if (open) load();
  }, [open, load]);

  const toggleTag = async (tagName: string) => {
    if (!ws || !contact) return;
    const names = contact.tags.map((t) => t.name);
    const next = names.includes(tagName) ? names.filter((n) => n !== tagName) : [...names, tagName];
    try {
      await api.patch(`/api/workspaces/${ws}/contacts/${contact.id}`, { tags: next });
      await load();
      toast.success(next.includes(tagName) ? `Added tag "${tagName}"` : `Removed tag "${tagName}"`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Tag update failed');
    }
  };

  const addNote = async () => {
    if (!ws || !contact || !note.trim()) return;
    try {
      await api.patch(`/api/workspaces/${ws}/contacts/${contact.id}`, { notes: note.trim() });
      setNote('');
      await load();
      toast.success('Note added');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to add note');
    }
  };

  const analyze = async () => {
    if (!ws) return;
    setAiLoading(true);
    try {
      const lead = await findLead(ws, contact?.id);
      if (lead) {
        const res = await api.post<{ intent: string; confidence: number; temperature: string; recommendedAction: string; summary: string[] }>(
          `/api/ai/leads/${lead.id}/analyze`,
        );
        setAiAnalysis(res);
      } else {
        const res = await api.post<{ summary: string[] }>(`/api/ai/summarize`, { conversationId: conversation.id });
        setAiAnalysis({ intent: '—', confidence: 0, temperature: 'Warm', recommendedAction: 'Create a lead to enable full AI analysis.', summary: res.summary });
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'AI analysis unavailable');
    } finally {
      setAiLoading(false);
    }
  };

  if (!open) return null;

  return (
    <aside className="hidden w-[340px] shrink-0 flex-col border-l border-ink-200 bg-white xl:flex">
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-ink-900">Customer</h3>
        <button onClick={onClose} className="rounded-md p-1 text-ink-400 hover:bg-ink-100"><X className="h-4 w-4" /></button>
      </div>

      {loading && !contact ? (
        <div className="space-y-3 p-4"><Skeleton className="h-16" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : contact ? (
        <div className="flex-1 overflow-y-auto">
          {/* Profile */}
          <div className="border-b border-ink-100 px-4 py-4 text-center">
            <div className="mx-auto mb-2 w-fit"><Avatar name={contact.name} size="xl" url={conversation.contact?.avatarUrl} /></div>
            <h4 className="text-[15px] font-bold text-ink-900">{contact.name}</h4>
            <div className="mt-1 flex items-center justify-center gap-2">
              <Badge label={contact.leadStatus} />
              <Badge label={contact.customerType} />
            </div>
            <div className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-ink-50 px-3 py-1.5">
              <span className="text-[12px] font-medium text-ink-600">Lead Score</span>
              <span className="text-sm font-bold text-whatsapp-600">{contact.leadScore}/100</span>
              {contact.leadScore >= 70 && <span className="text-[11px] font-medium text-orange-500">🔥 Hot</span>}
            </div>
          </div>

          {/* Contact info */}
          <div className="space-y-1.5 border-b border-ink-100 px-4 py-3 text-[13px]">
            <ContactRow icon={<Phone className="h-3.5 w-3.5" />} label={contact.phone} />
            {contact.email && <ContactRow icon={<Mail className="h-3.5 w-3.5" />} label={contact.email} />}
            {contact.company && <ContactRow icon={<Building2 className="h-3.5 w-3.5" />} label={contact.company} />}
            {contact.location && <ContactRow icon={<MapPin className="h-3.5 w-3.5" />} label={contact.location} />}
            {contact.assignedTo && <ContactRow icon={<Users className="h-3.5 w-3.5" />} label={`Agent: ${contact.assignedTo.name}`} />}
          </div>

          {/* AI analysis */}
          <div className="border-b border-ink-100 px-4 py-3">
            <button onClick={analyze} disabled={aiLoading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 px-3 py-2 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50">
              <Sparkles className="h-4 w-4" /> {aiLoading ? 'Analyzing…' : 'AI Lead Analysis'}
            </button>
            {aiAnalysis && (
              <div className="mt-2 rounded-lg border border-violet-200 bg-violet-50 p-3">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-medium text-violet-800">Intent: {aiAnalysis.intent}</span>
                  <span className="font-semibold text-violet-700">{aiAnalysis.confidence}%</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-violet-800">
                  Temperature: <span className={aiAnalysis.temperature === 'Hot' ? 'text-orange-600' : aiAnalysis.temperature === 'Warm' ? 'text-amber-600' : 'text-blue-600'}>{aiAnalysis.temperature}</span>
                </div>
                <div className="mt-1.5 text-[12px] text-violet-900">
                  <span className="font-semibold">Recommended:</span> {aiAnalysis.recommendedAction}
                </div>
                {aiAnalysis.summary?.length > 0 && (
                  <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[11px] text-violet-800">
                    {aiAnalysis.summary.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="border-b border-ink-100 px-4 py-3">
            <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-ink-700">
              <TagIcon className="h-3.5 w-3.5" /> Tags
            </div>
            <div className="flex flex-wrap gap-1.5">
              {contact.tags.map((t) => (
                <button key={t.id} onClick={() => toggleTag(t.name)} className="group relative" title="Click to remove">
                  <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium" style={{ background: hexToRgba(t.color, 0.1), borderColor: hexToRgba(t.color, 0.3), color: t.color }}>
                    {t.name} <span className="opacity-0 group-hover:opacity-100">✕</span>
                  </span>
                </button>
              ))}
              {contact.tags.length === 0 && <span className="text-[11px] text-ink-400">No tags</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {availableTags.filter((t) => !contact.tags.some((c) => c.id === t.id)).slice(0, 4).map((t) => (
                <button key={t.id} onClick={() => toggleTag(t.name)} className="flex items-center gap-0.5 rounded-full border border-dashed border-ink-300 px-2 py-0.5 text-[11px] text-ink-500 hover:border-ink-400 hover:bg-ink-50">
                  <Plus className="h-3 w-3" /> {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="border-b border-ink-100 px-4 py-3">
            <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-ink-700">
              <StickyNote className="h-3.5 w-3.5" /> Notes
            </div>
            <div className="flex gap-2">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a private note…"
                rows={2}
                className="flex-1 resize-none rounded-lg border border-ink-200 px-2.5 py-1.5 text-[12px] focus:border-whatsapp-400 focus:outline-none focus:ring-2 focus:ring-whatsapp-100"
              />
              <button onClick={addNote} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-whatsapp-500 text-white hover:bg-whatsapp-600"><Plus className="h-4 w-4" /></button>
            </div>
            <div className="mt-2 space-y-2">
              {contact.notes.slice(0, 4).map((n) => (
                <div key={n.id} className="rounded-lg border border-ink-100 bg-ink-50/60 p-2.5">
                  <p className="whitespace-pre-wrap text-[12px] text-ink-800">{n.body}</p>
                  <div className="mt-1 text-[10px] text-ink-400">{n.author?.name ?? 'Team'} · {timeAgo(n.createdAt)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Deals */}
          {contact.deals.length > 0 && (
            <div className="border-b border-ink-100 px-4 py-3">
              <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-ink-700">
                <Wallet className="h-3.5 w-3.5" /> Deals
              </div>
              <div className="space-y-1.5">
                {contact.deals.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2">
                    <div>
                      <div className="text-[12px] font-medium text-ink-900">{d.name}</div>
                      <div className="text-[10px] text-ink-400">{d.stage}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[12px] font-bold text-ink-900">{formatCurrency(d.value)}</div>
                      <Badge label={d.stage} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="px-4 py-3">
            <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-ink-700">
              <CalendarClock className="h-3.5 w-3.5" /> Timeline
            </div>
            <div className="relative ml-2 space-y-3 border-l border-ink-200 pl-4">
              {contact.activities.slice(0, 12).map((a) => (
                <div key={a.id} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-whatsapp-400" />
                  <div className="text-[12px] font-medium text-ink-800">{a.title}</div>
                  {a.actor?.name && <div className="text-[10px] text-ink-400">by {a.actor.name}</div>}
                  <div className="text-[10px] text-ink-400">{timeAgo(a.createdAt)}</div>
                </div>
              ))}
              {contact.activities.length === 0 && <div className="text-[11px] text-ink-400">No activity recorded</div>}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 text-[13px] text-ink-400">No contact linked to this conversation.</div>
      )}
    </aside>
  );
}

async function findLead(ws: string, contactId?: string) {
  if (!contactId) return null;
  try {
    const res = await api.get<{ items: any[] }>(`/api/workspaces/${ws}/leads?pageSize=1`);
    const lead = res.items.find((l) => l.contactId === contactId);
    return lead ?? null;
  } catch {
    return null;
  }
}

function ContactRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-ink-700">
      <span className="text-ink-400">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

void formatDateTime;
void MessageSquareText;