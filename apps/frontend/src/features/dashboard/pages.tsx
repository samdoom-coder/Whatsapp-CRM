import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MessageSquareText, Flame, Wallet, TrendingUp, Clock, Users, Inbox, CheckCircle2,
  AlertCircle, CalendarClock, ArrowRight, Activity,
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { KpiCard, Avatar, EmptyState, Skeleton } from '@/components/base';
import { formatCurrency, formatRelative, timeAgo } from '@/lib/format';

interface DashboardData {
  kpis: {
    totalConversations: number; openConversations: number; newLeads: number; openDeals: number;
    wonDeals: number; totalRevenue: number; wonRevenue: number; conversionRate: number;
    avgResponseMinutes: number; unreadCount: number; contacts: number; customers: number;
  };
  charts: {
    conversationsOverTime: Array<{ date: string; count: number }>;
    leadsOverTime: Array<{ date: string; count: number }>;
    pipeline: Array<{ stage: string; count: number; value: number }>;
  };
  today: { followUpsToday: number; overdueTasks: number; upcomingTasks: number; pendingTasks: number; assignedToMe: number };
  recentConversations: any[];
  recentActivity: any[];
  agentPerformance: any[];
}

export function DashboardPage() {
  const { currentWorkspaceId, socket } = useAuth();
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [days, setDays] = React.useState(30);
  const navigate = useNavigate();

  const load = React.useCallback(async () => {
    if (!currentWorkspaceId) return;
    try {
      const d = await api.get<DashboardData>(`/api/workspaces/${currentWorkspaceId}/dashboard?days=${days}`);
      setData(d);
    } catch {
      // handled by interceptor
    }
  }, [currentWorkspaceId, days]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    if (!socket) return;
    const refresh = () => load();
    socket.on('message:new', refresh);
    socket.on('conversation:updated', refresh);
    socket.on('deal:updated', refresh);
    socket.on('notification:new', refresh);
    return () => {
      socket.off('message:new', refresh);
      socket.off('conversation:updated', refresh);
      socket.off('deal:updated', refresh);
      socket.off('notification:new', refresh);
    };
  }, [socket, load]);

  if (!data) {
    return (
      <div className="p-6">
        <div className="mb-6 space-y-3">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  const k = data.kpis;
  const currency = useAuth.getState().workspaces.find((w) => w.id === currentWorkspaceId)?.currency ?? 'INR';

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-900">Dashboard</h1>
          <p className="mt-0.5 text-[13px] text-ink-500">Overview of your sales and messaging performance.</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-ink-200 bg-white p-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-md px-3 py-1.5 text-[12px] font-medium ${days === d ? 'bg-ink-900 text-white' : 'text-ink-500 hover:text-ink-800'}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Conversations" value={k.totalConversations} sub={`${k.openConversations} open`} icon={<MessageSquareText className="h-4 w-4" />} />
        <KpiCard label="New Leads" value={k.newLeads} sub={`${days} days`} icon={<Flame className="h-4 w-4" />} accent="amber" />
        <KpiCard label="Open Deals" value={k.openDeals} sub={`${k.wonDeals} won`} icon={<Wallet className="h-4 w-4" />} accent="purple" />
        <KpiCard label="Revenue" value={formatCurrency(k.wonRevenue, currency)} sub={`of ${formatCurrency(k.totalRevenue, currency)}`} icon={<TrendingUp className="h-4 w-4" />} />
        <KpiCard label="Conversion" value={`${k.conversionRate}%`} sub="leads → won" icon={<Activity className="h-4 w-4" />} accent="blue" />
        <KpiCard label="Response Time" value={k.avgResponseMinutes < 1 ? '<1m' : `${k.avgResponseMinutes}m`} sub="avg to reply" icon={<Clock className="h-4 w-4" />} accent="red" />
      </div>

      {/* Charts row */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-ink-200 bg-white p-5 shadow-card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink-900">Conversations & Leads</h3>
              <p className="text-xs text-ink-400">Activity over the last {days} days</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData(data)} margin={{ left: -14, right: 4 }}>
              <defs>
                <linearGradient id="gConv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#25d366" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#25d366" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gLead" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f2" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8e96a1' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8e96a1' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #d9dde1', fontSize: 12 }} />
              <Area type="monotone" dataKey="conversations" stroke="#25d366" strokeWidth={2} fill="url(#gConv)" />
              <Area type="monotone" dataKey="leads" stroke="#f59e0b" strokeWidth={2} fill="url(#gLead)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-5 shadow-card">
          <h3 className="text-sm font-semibold text-ink-900">Sales Pipeline</h3>
          <p className="text-xs text-ink-400">Deals by stage</p>
          <div className="mt-4 space-y-3">
            {data.charts.pipeline.map((p) => (
              <button key={p.stage} onClick={() => navigate('/deals')} className="group block w-full">
                <div className="mb-1 flex items-center justify-between text-[12px]">
                  <span className="font-medium text-ink-700">{p.stage}</span>
                  <span className="flex items-center gap-2 text-ink-400">
                    <span className="font-semibold text-ink-600">{p.count}</span>
                    <span>{formatCurrency(p.value, currency)}</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-whatsapp-500 to-emerald-400 transition-all group-hover:opacity-80" style={{ width: `${(p.count / Math.max(1, Math.max(...data.charts.pipeline.map((x) => x.count)))) * 100}%` }} />
                </div>
              </button>
            ))}
            <div className="grid grid-cols-2 gap-3 border-t border-ink-100 pt-3">
              <div>
                <div className="text-[11px] text-ink-400">Weighted pipeline</div>
                <div className="text-sm font-bold text-ink-900">{formatCurrency(pipelineValue(data) * 0.6, currency)}</div>
              </div>
              <div>
                <div className="text-[11px] text-ink-400">Won revenue</div>
                <div className="text-sm font-bold text-emerald-600">{formatCurrency(k.wonRevenue, currency)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Today + recent */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-ink-200 bg-white p-5 shadow-card">
          <h3 className="mb-4 text-sm font-semibold text-ink-900">Today's Activity</h3>
          <div className="space-y-2.5">
            <TodayRow icon={<CalendarClock className="h-4 w-4 text-whatsapp-600" />} label="Follow-ups due" value={data.today.followUpsToday} to="/tasks" />
            <TodayRow icon={<AlertCircle className="h-4 w-4 text-red-500" />} label="Overdue tasks" value={data.today.overdueTasks} to="/tasks?status=pending&overdue=1" danger />
            <TodayRow icon={<Inbox className="h-4 w-4 text-blue-500" />} label="Assigned conversations" value={data.today.assignedToMe} to="/inbox?filter=mine" />
            <TodayRow icon={<CheckCircle2 className="h-4 w-4 text-amber-500" />} label="Pending tasks" value={data.today.pendingTasks} to="/tasks" />
            <TodayRow icon={<MessageSquareText className="h-4 w-4 text-purple-500" />} label="Unread messages" value={k.unreadCount} to="/inbox?filter=unread" />
          </div>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-5 shadow-card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-900">Recent Conversations</h3>
            <Link to="/inbox" className="flex items-center gap-1 text-[12px] font-medium text-whatsapp-600 hover:underline">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {data.recentConversations.length === 0 ? (
            <EmptyState icon={<MessageSquareText className="h-5 w-5" />} title="No conversations yet" description="Incoming WhatsApp messages will appear here." />
          ) : (
            <div className="divide-y divide-ink-50">
              {data.recentConversations.map((c) => (
                <button key={c.id} onClick={() => navigate(`/inbox/${c.id}`)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-ink-50">
                  <Avatar name={c.contact?.name ?? 'C'} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-[13px] font-medium text-ink-900">{c.contact?.name}</span>
                      <span className="shrink-0 text-[11px] text-ink-400">{formatRelative(c.lastMessageAt)}</span>
                    </div>
                    <div className="truncate text-[12px] text-ink-500">{c.lastMessageText || '—'}</div>
                  </div>
                  {c.unreadCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-whatsapp-500 px-1.5 text-[10px] font-bold text-white">{c.unreadCount}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="mt-4 rounded-xl border border-ink-200 bg-white p-5 shadow-card">
        <h3 className="mb-4 text-sm font-semibold text-ink-900">Recent Activity</h3>
        {data.recentActivity.length === 0 ? (
          <EmptyState icon={<Activity className="h-5 w-5" />} title="No activity yet" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.recentActivity.map((a) => (
              <div key={a.id} className="flex items-start gap-3 rounded-lg border border-ink-100 p-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500">
                  <ActivityIcon type={a.type} />
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-ink-900">{a.title}</div>
                  {a.description && <div className="truncate text-[12px] text-ink-500">{a.description}</div>}
                  <div className="mt-0.5 text-[11px] text-ink-400">{timeAgo(a.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TodayRow({ icon, label, value, to, danger }: { icon: React.ReactNode; label: string; value: number; to: string; danger?: boolean }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-ink-50">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-50">{icon}</span>
      <span className="flex-1 text-[13px] text-ink-700">{label}</span>
      <span className={`text-sm font-bold ${danger && value > 0 ? 'text-red-600' : 'text-ink-900'}`}>{value}</span>
    </Link>
  );
}

function chartData(d: DashboardData) {
  const map = new Map(d.charts.conversationsOverTime.map((c) => [c.date, c.count]));
  const leads = new Map(d.charts.leadsOverTime.map((l) => [l.date, l.count]));
  const allDates = [...new Set([...map.keys(), ...leads.keys()])].sort();
  return allDates.map((date) => ({
    date: new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    conversations: map.get(date) ?? 0,
    leads: leads.get(date) ?? 0,
  }));
}

function pipelineValue(d: DashboardData) {
  return d.charts.pipeline.reduce((s, p) => s + p.value, 0);
}

function ActivityIcon({ type }: { type: string }) {
  if (type.includes('deal_won')) return <TrendingUp className="h-4 w-4 text-emerald-600" />;
  if (type.includes('message')) return <MessageSquareText className="h-4 w-4 text-blue-500" />;
  if (type.includes('lead')) return <Flame className="h-4 w-4 text-amber-500" />;
  if (type.includes('conversation')) return <Inbox className="h-4 w-4 text-purple-500" />;
  if (type.includes('task') || type.includes('follow_up')) return <CheckCircle2 className="h-4 w-4 text-whatsapp-600" />;
  return <Activity className="h-4 w-4 text-ink-400" />;
}

