import React from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { api, ApiError } from '@/lib/api';
import { Avatar, Badge, Skeleton } from '@/components/base';
import { toast } from '@/components/ui';
import { ConversationList } from './ConversationList';
import { ChatWindow } from './ChatWindow';
import { CustomerPanel } from './CustomerPanel';

export interface Message {
  id: string;
  conversationId: string;
  senderType: 'customer' | 'agent' | 'system';
  senderId?: string | null;
  externalMessageId?: string | null;
  messageType: string;
  body?: string | null;
  mediaUrl?: string | null;
  mimeType?: string | null;
  status: string;
  createdAt: string;
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  attachments: any[];
  sender?: { id: string; name: string } | null;
}

export interface Conversation {
  id: string;
  contact: {
    id: string; name: string; phone: string; avatarUrl?: string | null; leadStatus: string; leadScore: number;
    customerType: string; company?: string | null; tags: Array<{ id: string; name: string; color: string }>;
  } | null;
  assignedTo: { id: string; name: string; avatarUrl?: string | null } | null;
  status: string;
  priority: string;
  isStarred: boolean;
  unreadCount: number;
  lastMessageAt?: string | null;
  lastMessageText?: string | null;
  channel: string;
}

export function InboxPage() {
  const { conversationId } = useParams();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState(searchParams.get('filter') ?? 'all');
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState<Conversation | null>(null);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [total, setTotal] = React.useState(0);
  const navigate = useNavigate();
  const { socket } = useAuth();
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>();

  const loadConversations = React.useCallback(async (f = filter, q = search) => {
    const ws = useAuth.getState().currentWorkspaceId;
    if (!ws) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({ filter: f, pageSize: '50' });
      if (q) params.set('search', q);
      const res = await api.get<{ items: Conversation[]; total: number }>(`/api/workspaces/${ws}/conversations?${params}`);
      setConversations(res.items);
      setTotal(res.total);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadConversations();
  }, [loadConversations, filter]);

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadConversations(filter, search), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Select conversation from URL or first item
  React.useEffect(() => {
    if (conversationId) {
      const conv = conversations.find((c) => c.id === conversationId);
      if (conv) setSelected(conv);
    } else if (!selected && conversations.length > 0 && !search) {
      setSelected(conversations[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, conversationId]);

  // Load full selected conversation when switching
  const loadFullConversation = React.useCallback(async (id: string) => {
    const ws = useAuth.getState().currentWorkspaceId;
    if (!ws) return;
    try {
      const conv = await api.get<Conversation>(`/api/workspaces/${ws}/conversations/${id}`);
      setSelected(conv);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load conversation');
    }
  }, []);

  React.useEffect(() => {
    if (conversationId) loadFullConversation(conversationId);
    else if (selected?.id) loadFullConversation(selected.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Realtime updates
  React.useEffect(() => {
    if (!socket) return;
    const onMessage = (msg: Message) => {
      setConversations((prev) => {
        const exists = prev.find((c) => c.id === msg.conversationId);
        if (exists) {
          return prev
            .map((c) =>
              c.id === msg.conversationId
                ? {
                    ...c,
                    lastMessageText: msg.messageType === 'internal_note' ? '📝 Internal note' : (msg.body ?? '📎 Media'),
                    lastMessageAt: msg.createdAt,
                    unreadCount: msg.senderType === 'customer' ? c.unreadCount + 1 : c.unreadCount,
                  }
                : c,
            )
            .sort((a, b) => new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime());
        }
        return prev;
      });
    };
    const onConv = (conv: Conversation) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === conv.id);
        if (idx === -1) return [conv, ...prev];
        const next = [...prev];
        next[idx] = { ...next[idx], ...conv };
        return next;
      });
      setSelected((s) => (s && s.id === conv.id ? { ...s, ...conv } : s));
    };
    socket.on('message:new', onMessage);
    socket.on('conversation:updated', onConv);
    return () => {
      socket.off('message:new', onMessage);
      socket.off('conversation:updated', onConv);
    };
  }, [socket]);

  const selectConversation = (c: Conversation) => {
    setSelected(c);
    navigate(`/inbox/${c.id}`);
  };

  return (
    <div className="flex h-full">
      <ConversationList
        conversations={conversations}
        loading={loading}
        filter={filter}
        setFilter={(f) => {
          setFilter(f);
          navigate(f === 'all' ? '/inbox' : `/inbox?filter=${f}`);
        }}
        search={search}
        setSearch={setSearch}
        selectedId={selected?.id}
        onSelect={selectConversation}
        total={total}
        onNewConversation={() => {
          window.dispatchEvent(new CustomEvent('open-entity-modal'));
          navigate('/inbox?new=1');
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {selected ? (
          <ChatWindow
            conversation={selected}
            onConversationChange={setSelected}
            onOpenPanel={() => setPanelOpen(true)}
            onMarkRead={() =>
              setConversations((prev) => prev.map((c) => (c.id === selected.id ? { ...c, unreadCount: 0 } : c)))
            }
          />
        ) : loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-ink-50">
            <Skeleton className="h-20 w-48" />
            <p className="text-sm text-ink-400">Loading conversations…</p>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-ink-50">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-ink-300 shadow-card">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.84L3 20l1.07-3.32A7.96 7.96 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
            <p className="text-sm font-medium text-ink-600">Select a conversation</p>
            <p className="text-[13px] text-ink-400">Choose a conversation to start replying</p>
          </div>
        )}
      </div>

      {selected && (
        <CustomerPanel conversation={selected} open={panelOpen} onClose={() => setPanelOpen(false)} />
      )}
    </div>
  );
}

void Badge;