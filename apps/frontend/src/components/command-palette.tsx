import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, MessageSquareText, Wallet, Flame, CheckSquare, LayoutDashboard, Settings, Plus, CornerDownLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { Avatar } from '@/components/base';
import { createPortal } from 'react-dom';

interface SearchResults {
  contacts: any[];
  conversations: any[];
  deals: any[];
  leads: any[];
  tasks: any[];
  messages: any[];
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<SearchResults | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const navigate = useNavigate();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>();

  const actions = [
    { label: 'Go to Dashboard', icon: LayoutDashboard, run: () => navigate('/') },
    { label: 'Go to Inbox', icon: MessageSquareText, run: () => navigate('/inbox') },
    { label: 'Go to Contacts', icon: Users, run: () => navigate('/contacts') },
    { label: 'Go to Leads', icon: Flame, run: () => navigate('/leads') },
    { label: 'Go to Deals', icon: Wallet, run: () => navigate('/deals') },
    { label: 'Go to Tasks', icon: CheckSquare, run: () => navigate('/tasks') },
    { label: 'Go to Settings', icon: Settings, run: () => navigate('/settings') },
  ];

  React.useEffect(() => {
    const openHandler = () => setOpen(true);
    const keyHandler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('open-command-palette', openHandler);
    window.addEventListener('keydown', keyHandler);
    return () => {
      window.removeEventListener('open-command-palette', openHandler);
      window.removeEventListener('keydown', keyHandler);
    };
  }, []);

  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setResults(null);
      return;
    }
    setActive(0);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || !open) {
      setResults(null);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.get<SearchResults>(`/api/workspaces/${useWorkspaceId()}/search?q=${encodeURIComponent(query)}&limit=4`);
        setResults(data);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 250);
  }, [query, open]);

  const flattened = React.useMemo(() => {
    const items: Array<{ type: string; data: any }> = [];
    if (!results) return items;
    results.contacts?.forEach((c) => items.push({ type: 'Contact', data: c }));
    results.conversations?.forEach((c) => items.push({ type: 'Conversation', data: c }));
    results.deals?.forEach((d) => items.push({ type: 'Deal', data: d }));
    results.leads?.forEach((l) => items.push({ type: 'Lead', data: l }));
    results.tasks?.forEach((t) => items.push({ type: 'Task', data: t }));
    results.messages?.forEach((m) => items.push({ type: 'Message', data: m }));
    return items;
  }, [results]);

  const allItems = query.trim() ? flattened : actions;

  const run = (item: { type?: string; data?: any } | { run: () => void }) => {
    setOpen(false);
    if ('run' in item) {
      (item as any).run();
      return;
    }
    const i = item as { type: string; data: any };
    switch (i.type) {
      case 'Contact': navigate(`/contacts/${i.data.id}`); break;
      case 'Conversation': navigate(`/inbox/${i.data.id}`); break;
      case 'Deal': navigate(`/deals/${i.data.id}`); break;
      case 'Lead': navigate(`/leads/${i.data.id}`); break;
      case 'Task': navigate(`/tasks?focus=${i.data.id}`); break;
      case 'Message': navigate(`/inbox/${i.data.conversationId}`); break;
    }
  };

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, allItems.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
      if (e.key === 'Enter') { e.preventDefault(); allItems[active] && run(allItems[active]); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, allItems, active]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-ink-950/40 animate-fade-in" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-ink-200 bg-white shadow-pop animate-slide-up">
        <div className="flex items-center gap-3 border-b border-ink-100 px-4 py-3">
          <Search className="h-5 w-5 text-ink-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts, conversations, deals, tasks…"
            className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none"
          />
          <kbd className="rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 text-[10px] text-ink-400">esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {loading && <div className="px-4 py-3 text-[13px] text-ink-400">Searching…</div>}
          {!loading && allItems.length === 0 && (
            <div className="px-4 py-8 text-center text-[13px] text-ink-400">
              No results for “{query}”
            </div>
          )}
          {!loading && allItems.map((item, idx) => {
            const isAction = 'run' in item;
            const label = isAction ? (item as any).label : itemLabel(item as { type: string; data: any });
            const sub = isAction ? 'Navigate' : itemSub(item as { type: string; data: any });
            const icon = isAction ? (item as any).icon : itemIcon(item as { type: string; data: any });
            return (
              <button
                key={idx}
                onMouseEnter={() => setActive(idx)}
                onClick={() => run(item as any)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${idx === active ? 'bg-ink-50' : ''}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">{icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink-900">{label}</span>
                  <span className="block truncate text-[11px] text-ink-400">{sub}</span>
                </span>
                {isAction && <CornerDownLeft className="h-3.5 w-3.5 text-ink-300" />}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4 border-t border-ink-100 bg-ink-50/50 px-4 py-2 text-[10px] text-ink-400">
          <span><kbd className="rounded border border-ink-200 bg-white px-1">↑↓</kbd> Navigate</span>
          <span><kbd className="rounded border border-ink-200 bg-white px-1">↵</kbd> Select</span>
          <span><kbd className="rounded border border-ink-200 bg-white px-1">g</kbd> then <kbd className="rounded border border-ink-200 bg-white px-1">i</kbd> Inbox</span>
          <span><kbd className="rounded border border-ink-200 bg-white px-1">g</kbd> then <kbd className="rounded border border-ink-200 bg-white px-1">c</kbd> Contacts</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function useWorkspaceId() {
  return useAuthStore().currentWorkspaceId;
}

import { useAuth as useAuthStore } from '@/store/auth';

function itemIcon(item: { type: string; data: any }) {
  switch (item.type) {
    case 'Contact': return <Users className="h-4 w-4" />;
    case 'Conversation': return <MessageSquareText className="h-4 w-4" />;
    case 'Deal': return <Wallet className="h-4 w-4" />;
    case 'Lead': return <Flame className="h-4 w-4" />;
    case 'Task': return <CheckSquare className="h-4 w-4" />;
    case 'Message': return <MessageSquareText className="h-4 w-4" />;
    default: return <Search className="h-4 w-4" />;
  }
}

function itemLabel(item: { type: string; data: any }) {
  switch (item.type) {
    case 'Contact': return item.data.name;
    case 'Conversation': return `Conversation with ${item.data.contact?.name ?? 'customer'}`;
    case 'Deal': return item.data.name;
    case 'Lead': return item.data.name;
    case 'Task': return item.data.title;
    case 'Message': return item.data.body?.slice(0, 60);
    default: return '';
  }
}

function itemSub(item: { type: string; data: any }) {
  switch (item.type) {
    case 'Contact': return `${item.data.phone}${item.data.company ? ' · ' + item.data.company : ''}`;
    case 'Conversation': return item.data.contact?.phone;
    case 'Deal': return `₹${Number(item.data.value).toLocaleString('en-IN')} · ${item.data.stage}`;
    case 'Lead': return `${item.data.status} · Score ${item.data.score}`;
    case 'Task': return item.data.contact?.name ?? 'Task';
    case 'Message': return item.data.conversation?.contact?.name;
    default: return '';
  }
}