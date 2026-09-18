import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import { MessageSquareText, Users, TrendingUp, Wallet, Timer, Target } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';
import { KpiCard, Skeleton, Badge, Select } from '@/components/base';
import { formatCurrency, formatDuration } from '@/lib/format';

interface AnalyticsData {
  range: { days: number };
  messaging: { incoming: number; outgoing: number; conversations: number; responseTime: number; series: Array<{ date: string; incoming: number; outgoing: number }> };
  sales: { leads: number; qualifiedLeads: number; conversionRate: number; dealsWon: number; dealsLost: number; revenue: number; leadSeries: Array<{ date: string; count: number }>; revenueSeries: Array<{ date: string; value: number }>; dealBreakdown: Array<{ name: string; value: number }> };
  customers: { newCustomers: number; returningCustomers: number; total: number; retentionRate: number };
  team: Array<{ userId: string; name: string; role: string; conversations: number; messages: number; leads: number; dealsWon: number; revenue: number; avgResponseMinutes: number }>;
}

const PIE_COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6'];

export function AnalyticsPage() {
  const ws = useAuth((s) => s.currentWorkspaceId);
  const [data, setData] = React.useState<AnalyticsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [days, setDays] = React.useState('30');

  React.useEffect(() => {
    if (!ws) return;
    setLoading(true);
    api.get<AnalyticsData>(`/api/workspaces/${ws}/analytics?days=${days}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ws, days]);

  if (loading || !data) {
    return <div className="flex h-full flex-col gap-4 p-5"><Skeleton className="h-28" /><Skeleton className="h-72" /><Skeleton className="h-72" /></div>;
  }

  const maxTeamRevenue = Math.max(...data.team.map((t) => t.revenue), 0);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-ink-50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-ink-900">Analytics</h1>
          <p className="text-xs text-ink-500">Performance across messaging, sales and team</p>
        </div>
        <Select value={days} onChange={setDays} className="w-32" options={[{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }]} />
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Messages in" value={data.messaging.incoming} icon={<MessageSquareText className="h-4 w-4" />} sub={`${data.messaging.outgoing} outgoing`} />
        <KpiCard label="Conversations" value={data.messaging.conversations} icon={<Users className="h-4 w-4" />} accent="blue" sub={`${data.messaging.incoming + data.messaging.outgoing} total messages`} />
        <KpiCard label="Avg response" value={formatDuration(data.messaging.responseTime)} icon={<Timer className="h-4 w-4" />} accent="amber" sub="first reply time" />
        <KpiCard label="Revenue (won)" value={formatCurrency(data.sales.revenue)} icon={<Wallet className="h-4 w-4" />} accent="purple" sub={`${data.sales.dealsWon} deals won`} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="New leads" value={data.sales.leads} icon={<Target className="h-4 w-4" />} sub={`${data.sales.qualifiedLeads} qualified`} />
        <KpiCard label="Conversion rate" value={`${data.sales.conversionRate}%`} icon={<TrendingUp className="h-4 w-4" />} accent="blue" />
        <KpiCard label="New customers" value={data.customers.newCustomers} icon={<Users className="h-4 w-4" />} accent="amber" sub={`${data.customers.returningCustomers} returning`} />
        <KpiCard label="Retention rate" value={`${data.customers.retentionRate}%`} icon={<Users className="h-4 w-4" />} accent="purple" sub={`${data.customers.total} total customers`} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Card title="Messages over time" className="col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.messaging.series}>
              <defs>
                <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} width={30} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="incoming" stroke="#10b981" fill="url(#gIn)" name="Incoming" />
              <Area type="monotone" dataKey="outgoing" stroke="#3b82f6" fill="url(#gOut)" name="Outgoing" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Deal outcomes">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data.sales.dealBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3}>
                {data.sales.dealBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Card title="Revenue (won deals)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.sales.revenueSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} width={50} tickFormatter={(v: number) => v >= 100000 ? `${v / 100000}L` : String(v)} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }} formatter={(v: any) => [formatCurrency(Number(v)), 'Revenue']} />
              <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="New leads">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.sales.leadSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} width={30} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Team performance" className="mt-4">
        <div className="space-y-3">
          {data.team.map((m) => (
            <div key={m.userId} className="flex items-center gap-4">
              <div className="w-40 truncate text-[13px] font-medium text-ink-900">{m.name}</div>
              <Badge label={m.role} />
              <div className="flex-1">
                <div className="h-2.5 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-whatsapp-500 to-emerald-400" style={{ width: `${maxTeamRevenue ? (m.revenue / maxTeamRevenue) * 100 : 0}%` }} />
                </div>
              </div>
              <div className="w-24 text-right text-xs text-ink-500">₹{(m.revenue / 100000).toFixed(1)}L</div>
              <div className="w-36 text-right text-[11px] text-ink-400">{m.conversations} conv · {m.messages} msgs · {m.leads} leads · {m.dealsWon} won · {formatDuration(m.avgResponseMinutes)} avg</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-ink-200 bg-white p-4 shadow-card ${className}`}>
      <h3 className="mb-3 text-[13px] font-semibold text-ink-900">{title}</h3>
      {children}
    </div>
  );
}