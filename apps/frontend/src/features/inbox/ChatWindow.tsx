import React from 'react';
import { useAuth } from '@/store/auth';
import {
  Star, Archive, Phone, MoreVertical, PanelRight, Search, Send, Paperclip, Smile, FileText, Sparkles, StickyNote,
  CheckCheck, Check, ChevronUp, CornerDownLeft,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Avatar, Badge, Dropdown, DropdownItem } from '@/components/base';
import { toast } from '@/components/ui';
import { formatTime, formatDateTime } from '@/lib/format';
import type { Conversation, Message } from './pages';

const EMOJIS = ['😀', '😂', '😊', '😍', '🤔', '👍', '🙏', '🔥', '💯', '🎉', '❤️', '🤝', '✅', '⭐', '📦', '💰', '📞', '⏰'];

export function ChatWindow({
  conversation,
  onConversationChange,
  onOpenPanel,
  onMarkRead,
}: {
  conversation: Conversation;
  onConversationChange: (c: Conversation) => void;
  onOpenPanel: () => void;
  onMarkRead: () => void;
}) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [hasMore, setHasMore] = React.useState(false);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [composerMode, setComposerMode] = React.useState<'reply' | 'note'>('reply');
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiSummary, setAiSummary] = React.useState<string[] | null>(null);
  const [showEmoji, setShowEmoji] = React.useState(false);
  const [templates, setTemplates] = React.useState<any[]>([]);
  const [showTemplates, setShowTemplates] = React.useState(false);
  const [aiTone, setAiTone] = React.useState<'professional' | 'friendly' | 'short' | 'persuasive'>('professional');
  const [aiReply, setAiReply] = React.useState<string | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const { socket } = useAuth();
  const ws = useAuth((s) => s.currentWorkspaceId);
  const user = useAuth((s) => s.user);

  // Load messages
  const loadMessages = React.useCallback(async (cursor?: string) => {
    if (!ws) return;
    try {
      const params = new URLSearchParams({ limit: '40' });
      if (cursor) params.set('cursor', cursor);
      const res = await api.get<{ items: Message[]; nextCursor: string | null; hasMore: boolean }>(
        `/api/workspaces/${ws}/conversations/${conversation.id}/messages?${params}`,
      );
      if (cursor) {
        setMessages((prev) => [...res.items, ...prev]);
      } else {
        setMessages(res.items);
        setLoading(false);
      }
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load messages');
      setLoading(false);
    }
  }, [ws, conversation.id]);

  React.useEffect(() => {
    setLoading(true);
    setMessages([]);
    setAiSummary(null);
    setAiReply(null);
    loadMessages();
  }, [conversation.id, loadMessages]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [messages.length, conversation.id]);

  // Mark as read when opening
  React.useEffect(() => {
    if (!ws) return;
    api.post(`/api/workspaces/${ws}/conversations/${conversation.id}/read`).then(onMarkRead).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  // Realtime
  React.useEffect(() => {
    if (!socket) return;
    const onMessage = (msg: Message) => {
      if (msg.conversationId === conversation.id) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        if (msg.senderType === 'customer') {
          api.post(`/api/workspaces/${ws}/conversations/${conversation.id}/read`).then(onMarkRead).catch(() => {});
        }
      }
    };
    const onStatus = (msg: Message) => {
      if (msg.conversationId === conversation.id) {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)));
      }
    };
    const onRemoved = (m: { id: string }) => {
      setMessages((prev) => prev.filter((x) => x.id !== m.id));
    };
    socket.on('message:new', onMessage);
    socket.on('message:status', onStatus);
    socket.on('message:removed', onRemoved);
    return () => {
      socket.off('message:new', onMessage);
      socket.off('message:status', onStatus);
      socket.off('message:removed', onRemoved);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, conversation.id]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending || !ws) return;
    setSending(true);
    try {
      const isNote = composerMode === 'note';
      if (isNote) {
        const msg = await api.post<Message>(`/api/workspaces/${ws}/conversations/${conversation.id}/notes`, { body: text });
        setMessages((prev) => [...prev, msg]);
      } else {
        const msg = await api.post<Message>(`/api/workspaces/${ws}/conversations/${conversation.id}/messages`, { body: text });
        setMessages((prev) => [...prev, msg]);
      }
      setDraft('');
      setAiReply(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const generateReply = async () => {
    if (!ws) return;
    setAiLoading(true);
    try {
      const res = await api.post<{ reply: string }>(`/api/ai/reply`, { conversationId: conversation.id, tone: aiTone, draft: draft || undefined });
      setAiReply(res.reply);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'AI unavailable');
    } finally {
      setAiLoading(false);
    }
  };

  const summarize = async () => {
    if (!ws) return;
    setAiLoading(true);
    try {
      const res = await api.post<{ summary: string[] }>(`/api/ai/summarize`, { conversationId: conversation.id });
      setAiSummary(res.summary);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'AI unavailable');
    } finally {
      setAiLoading(false);
    }
  };

  const loadTemplates = async () => {
    if (!ws || templates.length) return;
    try {
      const res = await api.get<{ items: any[] }>(`/api/workspaces/${ws}/templates`);
      setTemplates(res.items.filter((t) => t.status === 'approved'));
    } catch {
      // ignore
    }
  };

  const updateConversation = async (patch: Partial<Conversation>) => {
    if (!ws) return;
    try {
      const res = await api.patch<Conversation>(`/api/workspaces/${ws}/conversations/${conversation.id}`, patch);
      onConversationChange({ ...conversation, ...res });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed');
    }
  };

  const assignToMe = async () => {
    if (!ws) return;
    try {
      await api.patch(`/api/workspaces/${ws}/conversations/${conversation.id}`, { assignedToId: user?.id });
      toast.success('Conversation assigned to you');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Assignment failed');
    }
  };

  const groupedMessages = groupByDay(messages);

  return (
    <div className="flex h-full flex-col bg-[#f0f2f5]">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-ink-200 bg-white px-4">
        <Avatar name={conversation.contact?.name ?? 'C'} size="sm" url={conversation.contact?.avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-ink-900">{conversation.contact?.name ?? 'Unknown customer'}</span>
            <Badge label={conversation.contact?.leadStatus ?? 'Lead'} />
          </div>
          <div className="text-[11px] text-ink-500">
            {conversation.assignedTo ? `Assigned to ${conversation.assignedTo.name}` : 'Unassigned'} · {conversation.contact?.phone}
          </div>
        </div>
        <button onClick={summarize} title="AI summary" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100">
          <Sparkles className="h-4 w-4" />
        </button>
        <button onClick={onOpenPanel} title="Customer profile" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100">
          <PanelRight className="h-4 w-4" />
        </button>
        <Dropdown
          width="w-52"
          trigger={
            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100">
              <MoreVertical className="h-4 w-4" />
            </button>
          }
        >
          {(close) => (
            <>
              <DropdownItem icon={<Star className={`h-4 w-4 ${conversation.isStarred ? 'fill-amber-400 text-amber-400' : ''}`} />} label={conversation.isStarred ? 'Unstar' : 'Star'} onClick={() => { updateConversation({ isStarred: !conversation.isStarred }); close(); }} />
              <DropdownItem icon={<Phone className="h-4 w-4" />} label="Assign to me" onClick={() => { assignToMe(); close(); }} />
              <DropdownItem icon={<Archive className="h-4 w-4" />} label={conversation.status === 'archived' ? 'Unarchive' : 'Archive'} onClick={() => { updateConversation({ status: conversation.status === 'archived' ? 'open' : 'archived' }); close(); }} />
            </>
          )}
        </Dropdown>
      </div>

      {/* AI summary banner */}
      {aiSummary && (
        <div className="shrink-0 border-b border-whatsapp-200 bg-whatsapp-50 px-4 py-2.5">
          <div className="mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-whatsapp-800">
              <Sparkles className="h-3.5 w-3.5" /> AI Conversation Summary
            </span>
            <button onClick={() => setAiSummary(null)} className="text-[11px] text-whatsapp-600 hover:underline">Dismiss</button>
          </div>
          <ul className="list-inside list-disc space-y-0.5 text-[12px] text-whatsapp-900">
            {aiSummary.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center text-[13px] text-ink-400">Loading messages…</div>
        ) : (
          <>
            {hasMore && (
              <div className="mb-3 text-center">
                <button onClick={() => loadMessages(nextCursor ?? undefined)} className="rounded-full border border-ink-200 bg-white px-3 py-1 text-[11px] font-medium text-ink-600 hover:bg-ink-50">
                  <ChevronUp className="mr-1 inline h-3 w-3" /> Load earlier
                </button>
              </div>
            )}
            {groupedMessages.map((group) => (
              <div key={group.date} className="mb-4">
                <div className="mb-3 flex justify-center">
                  <span className="rounded-md bg-white px-2.5 py-0.5 text-[10px] font-medium text-ink-400 shadow-card">{group.label}</span>
                </div>
                <div className="space-y-1.5">
                  {group.items.map((m) => (
                    <MessageBubble key={m.id} message={m} />
                  ))}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* AI reply suggestion */}
      {aiReply && (
        <div className="shrink-0 border-t border-whatsapp-200 bg-whatsapp-50 px-4 py-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-whatsapp-800">
              <Sparkles className="h-3 w-3" /> AI suggested reply ({aiTone})
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => { setDraft(aiReply); setAiReply(null); textareaRef.current?.focus(); }} className="text-[11px] font-medium text-whatsapp-700 hover:underline">Use</button>
              <button onClick={() => setAiReply(null)} className="text-[11px] text-ink-400 hover:underline">Dismiss</button>
            </div>
          </div>
          <div className="rounded-lg bg-white p-2.5 text-[13px] text-ink-800">{aiReply}</div>
        </div>
      )}

      {/* Composer */}
      <div className="shrink-0 border-t border-ink-200 bg-white px-3 py-2.5">
        <div className="mb-2 flex items-center gap-1.5">
          <ModeButton active={composerMode === 'reply'} onClick={() => setComposerMode('reply')} icon={<Send className="h-3.5 w-3.5" />} label="Reply" />
          <ModeButton active={composerMode === 'note'} onClick={() => setComposerMode('note')} icon={<StickyNote className="h-3.5 w-3.5" />} label="Internal Note" />
          <div className="flex-1" />
          <button onClick={generateReply} disabled={aiLoading} className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 px-2.5 py-1.5 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-50">
            <Sparkles className="h-3.5 w-3.5" />
            {aiLoading ? 'Generating…' : 'Generate Reply'}
          </button>
        </div>
        {composerMode === 'reply' && (
          <div className="mb-1.5 flex items-center gap-1">
            <span className="text-[10px] font-medium text-ink-400">Tone:</span>
            {(['professional', 'friendly', 'short', 'persuasive'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setAiTone(t)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${aiTone === t ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-500 hover:bg-ink-200'}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {composerMode === 'note' && (
          <div className="mb-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
            📝 Internal notes are visible only to your team — never sent to the customer on WhatsApp.
          </div>
        )}

        <div className="relative">
          {showTemplates && (
            <div className="absolute bottom-full left-0 z-20 mb-2 max-h-64 w-full overflow-y-auto rounded-lg border border-ink-200 bg-white shadow-pop">
              <div className="flex items-center justify-between border-b border-ink-100 px-3 py-2">
                <span className="text-[12px] font-semibold text-ink-900">Message Templates</span>
                <button onClick={() => setShowTemplates(false)} className="text-[11px] text-ink-400">Close</button>
              </div>
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setDraft(renderTemplate(t.body, conversation.contact)); setShowTemplates(false); textareaRef.current?.focus(); }}
                  className="block w-full border-b border-ink-50 px-3 py-2 text-left hover:bg-ink-50"
                >
                  <div className="text-[12px] font-medium text-ink-900">{t.name}</div>
                  <div className="truncate text-[11px] text-ink-500">{t.body}</div>
                </button>
              ))}
              {templates.length === 0 && <div className="px-3 py-4 text-center text-[12px] text-ink-400">No approved templates yet</div>}
            </div>
          )}

          {showEmoji && (
            <div className="absolute bottom-full left-0 z-20 mb-2 grid w-72 grid-cols-8 gap-1 rounded-lg border border-ink-200 bg-white p-2 shadow-pop">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => { setDraft((d) => d + e); setShowEmoji(false); textareaRef.current?.focus(); }} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-ink-50">
                  {e}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <div className="flex items-center gap-0.5">
              <ComposerIconButton onClick={() => setShowEmoji((s) => !s)} icon={<Smile className="h-5 w-5" />} title="Emoji" />
              <ComposerIconButton onClick={() => { loadTemplates(); setShowTemplates((s) => !s); }} icon={<FileText className="h-5 w-5" />} title="Templates" />
            </div>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder={composerMode === 'note' ? 'Write an internal note…' : 'Type a message…'}
              className="max-h-32 min-h-[38px] flex-1 resize-none rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-[13px] focus:border-whatsapp-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-whatsapp-100"
            />
            <button
              onClick={send}
              disabled={!draft.trim() || sending}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-whatsapp-500 text-white transition-colors hover:bg-whatsapp-600 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-1 flex items-center justify-between px-1 text-[10px] text-ink-300">
            <span>{composerMode === 'reply' ? 'Press ⌘+Enter to send' : 'Never sent to customer'}</span>
            <span><CornerDownLeft className="inline h-3 w-3" /> ⌘+Enter</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
        active ? 'bg-whatsapp-50 text-whatsapp-700 ring-1 ring-whatsapp-200' : 'text-ink-500 hover:bg-ink-100'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ComposerIconButton({ onClick, icon, title }: { onClick: () => void; icon: React.ReactNode; title: string }) {
  return (
    <button onClick={onClick} title={title} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-600">
      {icon}
    </button>
  );
}

export function MessageBubble({ message }: { message: Message }) {
  const isCustomer = message.senderType === 'customer';
  const isNote = message.messageType === 'internal_note';

  if (isNote) {
    return (
      <div className="mx-auto max-w-[85%] animate-fade-in">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900 shadow-card">
          <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
            <StickyNote className="h-3 w-3" /> Internal Note
          </div>
          <p className="whitespace-pre-wrap">{message.body}</p>
          <div className="mt-1 text-right text-[10px] text-amber-500">{formatTime(message.createdAt)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isCustomer ? 'justify-start' : 'justify-end'} animate-fade-in`}>
      <div className={`relative max-w-[75%] rounded-2xl px-3 py-2 text-[13px] shadow-card ${isCustomer ? 'rounded-tl-sm bg-white text-ink-900' : 'rounded-tr-sm bg-[#d9fdd3] text-ink-900'}`}>
        <div className="flex items-start gap-2">
          {message.mediaUrl && (
            <img src={message.mediaUrl} alt="" className="mb-1 max-h-48 rounded-lg object-cover" />
          )}
          <div>
            <p className="whitespace-pre-wrap break-words">{message.body}</p>
            <div className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] text-ink-400`}>
              {formatTime(message.createdAt)}
              {!isCustomer && <MessageTicks status={message.status} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageTicks({ status }: { status: string }) {
  if (status === 'failed') return <span className="font-medium text-red-500">✕</span>;
  if (status === 'read') return <CheckCheck className="h-3.5 w-3.5 text-blue-500" />;
  if (status === 'delivered') return <CheckCheck className="h-3.5 w-3.5 text-ink-400" />;
  return <Check className="h-3.5 w-3.5 text-ink-400" />;
}

function groupByDay(messages: Message[]) {
  const groups: Array<{ date: string; label: string; items: Message[] }> = [];
  for (const m of messages) {
    const d = new Date(m.createdAt);
    const key = d.toDateString();
    const last = groups[groups.length - 1];
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400_000).toDateString();
    const label = key === today ? 'Today' : key === yesterday ? 'Yesterday' : d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
    if (last && last.date === key) last.items.push(m);
    else groups.push({ date: key, label, items: [m] });
  }
  return groups;
}

function renderTemplate(body: string, contact?: Conversation['contact']) {
  return body
    .replace(/{{customer_name}}/g, contact?.name ?? 'there')
    .replace(/{{company_name}}/g, 'Acme Solutions')
    .replace(/{{agent_name}}/g, 'our team')
    .replace(/{{deal_value}}/g, 'your quotation')
    .replace(/{{appointment_date}}/g, 'next week');
}

void formatDateTime;
void Paperclip;
void Search;