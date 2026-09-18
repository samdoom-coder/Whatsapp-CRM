import React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import { avatarColor, initials } from '@/lib/format';

// ---------------- Avatar ----------------
export function Avatar({ name, url, size = 'md', status }: { name: string; url?: string | null; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; status?: string }) {
  const sizes = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-xl',
  };
  const bg = avatarColor(name);
  return (
    <div className={`relative inline-flex shrink-0 ${sizes[size]}`}>
      {url ? (
        <img src={url} alt={name} className={`rounded-full object-cover ${sizes[size]}`} />
      ) : (
        <div className={`flex items-center justify-center rounded-full font-semibold text-white ${sizes[size]}`} style={{ background: bg }}>
          {initials(name)}
        </div>
      )}
      {status && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white" title={status} />}
    </div>
  );
}

// ---------------- Badge ----------------
const badgeColors: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  gray: 'bg-ink-50 text-ink-600 border-ink-200',
};

export function badgeColorFor(value: string): string {
  const v = value.toLowerCase();
  if (/won|approved|qualified|success|completed|active|delivered|paid|connected/.test(v)) return 'green';
  if (/lost|failed|rejected|overdue|cancelled|cold|error|disconnected/.test(v)) return 'red';
  if (/proposal|contacted|pending|warm|sent|processing/.test(v)) return 'blue';
  if (/negotiation|urgent|high|new/.test(v)) return 'amber';
  if (/vip|premium|qualif/.test(v)) return 'purple';
  if (/lead/.test(v)) return 'cyan';
  return 'gray';
}

export function Badge({ label, color, className = '' }: { label: string; color?: string; className?: string }) {
  const c = color ?? badgeColorFor(label);
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeColors[c]} ${className}`}>
      {label}
    </span>
  );
}

// ---------------- Select ----------------
export function Select({
  value,
  onChange,
  options,
  placeholder,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full appearance-none rounded-lg border border-ink-200 bg-white pl-3 pr-8 text-sm text-ink-800 focus:border-whatsapp-400 focus:outline-none focus:ring-2 focus:ring-whatsapp-100"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
    </div>
  );
}

export function Input({ label, error, className = '', ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-[13px] font-medium text-ink-700">{label}</span>}
      <input
        className={`h-9 w-full rounded-lg border bg-white px-3 text-sm text-ink-800 placeholder:text-ink-400 focus:border-whatsapp-400 focus:outline-none focus:ring-2 focus:ring-whatsapp-100 ${error ? 'border-red-300' : 'border-ink-200'} ${className}`}
        {...rest}
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function TextArea({ label, error, className = '', ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-[13px] font-medium text-ink-700">{label}</span>}
      <textarea
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:border-whatsapp-400 focus:outline-none focus:ring-2 focus:ring-whatsapp-100 ${error ? 'border-red-300' : 'border-ink-200'} ${className}`}
        {...rest}
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

// ---------------- Dropdown ----------------
export function Dropdown({
  trigger,
  children,
  align = 'right',
  width = 'w-48',
}: {
  trigger: React.ReactNode;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  align?: 'left' | 'right';
  width?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const close = () => setOpen(false);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open &&
        createPortal(
          <div
            className={`absolute z-[70] mt-1 ${width} rounded-lg border border-ink-200 bg-white py-1 shadow-pop animate-fade-in ${align === 'right' ? 'right-0' : 'left-0'}`}
            style={{ top: ref.current?.getBoundingClientRect().bottom ?? 0 }}
          >
            {typeof children === 'function' ? children(close) : children}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function DropdownItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon?: React.ReactNode;
  label: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] ${danger ? 'text-red-600 hover:bg-red-50' : 'text-ink-700 hover:bg-ink-50'}`}
    >
      {icon}
      {label}
    </button>
  );
}

// ---------------- Tabs ----------------
export function Tabs({ tabs, value, onChange }: { tabs: Array<{ value: string; label: React.ReactNode; count?: number }>; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
            value === t.value ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
          }`}
        >
          {t.label}
          {t.count !== undefined && t.count > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${value === t.value ? 'bg-white/20 text-white' : 'bg-ink-100 text-ink-500'}`}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------------- KPI Card ----------------
export function KpiCard({ label, value, sub, icon, accent = 'green' }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode; accent?: 'green' | 'blue' | 'amber' | 'purple' | 'red' }) {
  const accents = {
    green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-ink-500">{label}</span>
        {icon && <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${accents[accent]}`}>{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-ink-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-500">{sub}</div>}
    </div>
  );
}

// ---------------- Empty State ----------------
export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-400">{icon}</div>}
      <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-[13px] text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---------------- Skeleton ----------------
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-ink-100 ${className}`} />;
}

// ---------------- Checkbox ----------------
export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${checked ? 'border-whatsapp-500 bg-whatsapp-500' : 'border-ink-300 bg-white'}`}
      >
        {checked && <Check className="h-3 w-3 text-white" />}
      </button>
      {label && <span className="text-sm text-ink-700">{label}</span>}
    </label>
  );
}