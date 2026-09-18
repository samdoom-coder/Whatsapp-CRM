import React from 'react';
import { Search, Inbox, Star, Inbox as InboxIcon, MessageSquareText, Plus, Filter } from 'lucide-react';
import { Avatar, Badge, EmptyState, Skeleton, Dropdown, DropdownItem } from '@/components/base';
import { formatRelative } from '@/lib/format';
import type { Conversation } from './pages';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'mine', label: 'Assigned to me' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'starred', label: 'Starred' },
  { value: 'leads', label: 'Leads' },
  { value: 'customers', label: 'Customers' },
  { value: 'archived', label: 'Archived' },
];

export function ConversationList({
  conversations,
  loading,
  filter,
  setFilter,
  search,
  setSearch,
  selectedId,
  onSelect,
  total,
  onNewConversation,
}: {
  conversations: Conversation[];
  loading: boolean;
  filter: string;
  setFilter: (f: string) => void;
  search: string;
  setSearch: (s: string) => void;
  selectedId?: string;
  onSelect: (c: Conversation) => void;
  total: number;
  onNewConversation: () => void;
}) {
  return (
    <div className="flex w-[300px] shrink-0 flex-col border-r border-ink-200 bg-white xl:w-[330px]">
      <div className="border-b border-ink-100 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink-900">Inbox</h2>
          <button onClick={onNewConversation} className="flex h-7 w-7 items-center justify-center rounded-lg bg-whatsapp-500 text-white hover:bg-whatsapp-600">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="h-9 w-full rounded-lg border border-ink-200 bg-ink-50 pl-9 pr-3 text-[13px] placeholder:text-ink-400 focus:border-whatsapp-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-whatsapp-100"
          />
        </div>
        <div className="mt-2 flex gap-1 overflow-x-auto scrollbar-none">
          {FILTERS.slice(0, 5).map((f) => (
            <FilterChip key={f.value} active={filter === f.value} onClick={() => setFilter(f.value)} label={f.label} />
          ))}
        </div>
        <div className="mt-1.5 flex gap-1 overflow-x-auto scrollbar-none">
          {FILTERS.slice(5).map((f) => (
            <FilterChip key={f.value} active={filter === f.value} onClick={() => setFilter(f.value)} label={f.label} />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-medium text-ink-400">
        <span>{total} conversations</span>
        <Dropdown
          width="w-44"
          trigger={
            <button className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-ink-100">
              <Filter className="h-3 w-3" /> More filters
            </button>
          }
        >
          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase text-ink-400">Advanced filters</div>
          <DropdownItem label="Only starred" icon={<Star className="h-4 w-4" />} onClick={() => setFilter('starred')} />
          <DropdownItem label="Leads only" icon={<InboxIcon className="h-4 w-4" />} onClick={() => setFilter('leads')} />
          <DropdownItem label="Customers" icon={<Inbox className="h-4 w-4" />} onClick={() => setFilter('customers')} />
          <DropdownItem label="Archived" icon={<Inbox className="h-4 w-4" />} onClick={() => setFilter('archived')} />
        </Dropdown>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg p-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <EmptyState icon={<MessageSquareText className="h-5 w-5" />} title="No conversations found" description="Try a different filter or search query." />
        ) : (
          conversations.map((c) => {
            const isActive = c.id === selectedId;
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c)}
                className={`flex w-full items-start gap-2.5 border-b border-ink-50 px-3 py-2.5 text-left transition-colors ${isActive ? 'bg-whatsapp-50' : 'hover:bg-ink-50'}`}
              >
                <Avatar name={c.contact?.name ?? 'C'} size="md" url={c.contact?.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-semibold text-ink-900">{c.contact?.name ?? 'Unknown'}</span>
                    <span className="shrink-0 text-[10px] text-ink-400">{formatRelative(c.lastMessageAt)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className={`truncate text-[12px] ${c.unreadCount > 0 ? 'font-medium text-ink-800' : 'text-ink-500'}`}>
                      {c.lastMessageText || (c.channel === 'whatsapp' ? 'WhatsApp conversation' : '—')}
                    </span>
                    {c.unreadCount > 0 && (
                      <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-whatsapp-500 px-1 text-[9px] font-bold text-white">{c.unreadCount}</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {c.isStarred && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                    {c.contact?.tags?.slice(0, 2).map((t) => <Badge key={t.id} label={t.name} color={tagColor(t.color)} className="!px-1.5 !py-0 !text-[9px]" />)}
                    {c.assignedTo && <span className="text-[10px] text-ink-400">· {c.assignedTo.name.split(' ')[0]}</span>}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${active ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}
    >
      {label}
    </button>
  );
}

function tagColor(hex?: string): string {
  switch (hex) {
    case '#f59e0b': return 'amber';
    case '#3b82f6': return 'blue';
    case '#10b981': return 'green';
    case '#ef4444': return 'red';
    case '#8b5cf6': return 'purple';
    case '#06b6d4': return 'cyan';
    default: return 'gray';
  }
}