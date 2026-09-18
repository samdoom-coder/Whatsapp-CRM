import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquareText,
  Users,
  Flame,
  Wallet,
  CheckSquare,
  Zap,
  FileText,
  BarChart3,
  UsersRound,
  Settings,
  Plus,
  LogOut,
  Search,
} from 'lucide-react';
import { useAuth } from '@/store/auth';
import { Avatar, Dropdown, DropdownItem } from '@/components/base';
import { toast } from '@/components/ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/inbox', label: 'Inbox', icon: MessageSquareText },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/leads', label: 'Leads', icon: Flame },
  { to: '/deals', label: 'Deals', icon: Wallet },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/automations', label: 'Automations', icon: Zap },
  { to: '/templates', label: 'Templates', icon: FileText },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
];

const SECONDARY = [
  { to: '/team', label: 'Team', icon: UsersRound },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const MOBILE_NAV = [
  { to: '/inbox', label: 'Inbox', icon: MessageSquareText },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/deals', label: 'Deals', icon: Wallet },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, workspaces, currentWorkspaceId, setCurrentWorkspace, logout } = useAuth();
  const navigate = useNavigate();
  const workspace = workspaces.find((w) => w.id === currentWorkspaceId);

  const quickActions = [
    { label: 'New Contact', path: '/contacts?new=1', icon: Users },
    { label: 'New Lead', path: '/leads?new=1', icon: Flame },
    { label: 'New Deal', path: '/deals?new=1', icon: Wallet },
    { label: 'New Task', path: '/tasks?new=1', icon: CheckSquare },
    { label: 'New Conversation', path: '/inbox?new=1', icon: MessageSquareText },
    { label: 'New Automation', path: '/automations?new=1', icon: Zap },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-ink-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 flex-col bg-ink-950 text-ink-200 lg:flex">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-whatsapp-500 text-white">
            <MessageSquareText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-white">{workspace?.companyName || 'WhatsApp CRM'}</div>
            <div className="text-[11px] text-ink-400">{workspace?.name}</div>
          </div>
        </div>

        <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                  isActive ? 'bg-ink-800 text-white' : 'text-ink-300 hover:bg-ink-800/50 hover:text-white'
                }`
              }
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </NavLink>
          ))}
          <div className="my-3 h-px bg-ink-800" />
          {SECONDARY.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                  isActive ? 'bg-ink-800 text-white' : 'text-ink-300 hover:bg-ink-800/50 hover:text-white'
                }`
              }
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-ink-800 p-2">
          {/* workspace switcher */}
          <Dropdown
            width="w-56"
            trigger={
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-ink-800/50 cursor-pointer">
                <Avatar name={workspace?.name ?? 'W'} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-white">{workspace?.name}</div>
                  <div className="text-[11px] text-ink-400">Switch workspace</div>
                </div>
              </div>
            }
          >
            {(close) => (
              <>
                <div className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Workspaces</div>
                {workspaces.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => {
                      setCurrentWorkspace(w.id);
                      navigate('/');
                      close();
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-ink-50 ${w.id === currentWorkspaceId ? 'text-whatsapp-600 font-medium' : 'text-ink-700'}`}
                  >
                    <Avatar name={w.name} size="xs" />
                    <span className="truncate">{w.name}</span>
                  </button>
                ))}
                <div className="my-1 h-px bg-ink-100" />
                <button
                  onClick={() => {
                    logout();
                    close();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </>
            )}
          </Dropdown>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-ink-200 bg-white px-4">
          <button onClick={() => navigate('/')} className="flex h-8 w-8 items-center justify-center rounded-lg bg-whatsapp-500 text-white lg:hidden">
            <MessageSquareText className="h-4 w-4" />
          </button>

          {/* global search trigger */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
            className="hidden h-9 w-72 items-center gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 text-left text-[13px] text-ink-400 transition-colors hover:border-ink-300 hover:bg-white sm:flex"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1">Search anything…</span>
            <kbd className="rounded border border-ink-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-ink-400">⌘K</kbd>
          </button>

          <div className="flex-1" />

          {/* quick add */}
          <Dropdown
            width="w-52"
            trigger={
              <button className="flex h-9 items-center gap-1.5 rounded-lg bg-ink-900 px-3 text-[13px] font-medium text-white hover:bg-ink-800">
                <Plus className="h-4 w-4" />
                New
              </button>
            }
          >
            {(close) => (
              <>
                {quickActions.map((a) => (
                  <button
                    key={a.label}
                    onClick={() => {
                      navigate(a.path);
                      close();
                      setTimeout(() => window.dispatchEvent(new CustomEvent('open-entity-modal')), 100);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-ink-700 hover:bg-ink-50"
                  >
                    <a.icon className="h-4 w-4 text-ink-400" />
                    {a.label}
                  </button>
                ))}
              </>
            )}
          </Dropdown>

          {/* notifications */}
          <NotificationBell />

          {/* user */}
          <Dropdown
            width="w-48"
            trigger={
              <div className="flex cursor-pointer items-center gap-2 rounded-lg p-1 hover:bg-ink-100">
                <Avatar name={user?.name ?? 'U'} size="sm" />
                <span className="hidden text-[13px] font-medium text-ink-800 md:block">{user?.name?.split(' ')[0]}</span>
              </div>
            }
          >
            {(close) => (
              <>
                <div className="border-b border-ink-100 px-3 py-2">
                  <div className="text-[13px] font-semibold text-ink-900">{user?.name}</div>
                  <div className="text-[11px] text-ink-400">{user?.email}</div>
                </div>
                <button onClick={() => { navigate('/settings'); close(); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-ink-700 hover:bg-ink-50">
                  <Settings className="h-4 w-4 text-ink-400" />
                  Settings
                </button>
                <button
                  onClick={() => {
                    logout();
                    close();
                    toast.info('Logged out');
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </>
            )}
          </Dropdown>
        </header>

        {/* Mobile bottom nav */}
        <nav className="flex shrink-0 border-t border-ink-200 bg-white lg:hidden">
          {MOBILE_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/inbox'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${isActive ? 'text-whatsapp-600' : 'text-ink-400'}`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}

function NotificationBell() {
  const [notifications, setNotifications] = React.useState<Array<{ id: string; title: string; body?: string; link?: string; readAt: string | null; createdAt: string }>>([]);
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();
  const { currentWorkspaceId, socket } = useAuth();

  React.useEffect(() => {
    if (!currentWorkspaceId) return;
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspaceId]);

  React.useEffect(() => {
    if (!socket) return;
    const handler = (n: any) => {
      setNotifications((prev) => [n, ...prev].slice(0, 30));
    };
    socket.on('notification:new', handler);
    return () => {
      socket.off('notification:new', handler);
    };
  }, [socket]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspaceId}/notifications`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.items);
      }
    } catch {
      // ignore
    }
  };

  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="relative">
      <button
        onClick={async () => {
          setOpen(!open);
          if (!open) await fetchNotifications();
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-pop">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-2.5">
              <span className="text-[13px] font-semibold text-ink-900">Notifications</span>
              <button
                onClick={async () => {
                  await fetch(`/api/workspaces/${currentWorkspaceId}/notifications/read-all`, { method: 'POST' });
                  setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
                }}
                className="text-[11px] font-medium text-whatsapp-600 hover:underline"
              >
                Mark all read
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-ink-400">No notifications yet</div>}
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (n.link) navigate(n.link);
                    if (!n.readAt) fetch(`/api/workspaces/${currentWorkspaceId}/notifications/${n.id}/read`, { method: 'POST' });
                    setOpen(false);
                  }}
                  className={`flex w-full items-start gap-3 border-b border-ink-50 px-4 py-3 text-left hover:bg-ink-50 ${!n.readAt ? 'bg-whatsapp-50/40' : ''}`}
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!n.readAt ? 'bg-whatsapp-500' : 'bg-ink-200'}`} />
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-ink-900">{n.title}</div>
                    {n.body && <div className="mt-0.5 truncate text-xs text-ink-500">{n.body}</div>}
                    <div className="mt-0.5 text-[10px] text-ink-400">{timeAgo(n.createdAt)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import { Bell } from 'lucide-react';
import { timeAgo } from '@/lib/format';