import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MessageSquareText, Lock, Mail, User, Building2, ArrowRight, KeyRound, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/components/ui';
import { Button } from '@/components/ui';

export function LoginPage() {
  const [email, setEmail] = React.useState('agent@acme.com');
  const [password, setPassword] = React.useState('password123');
  const [loading, setLoading] = React.useState(false);
  const setSession = useAuth((s) => s.setSession);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: any; workspaces: any[] }>('/api/auth/login', { email, password });
      api.setToken(res.token);
      setSession(res.token, res.user, res.workspaces);
      toast.success(`Welcome back, ${res.user.name.split(' ')[0]}!`);
      navigate('/');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-whatsapp-500 text-white shadow-pop">
            <MessageSquareText className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">WhatsApp CRM</h1>
          <p className="mt-1 text-sm text-ink-500">Every conversation, connected to a complete customer profile.</p>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-ink-200 bg-white p-6 shadow-card">
          <label className="mb-1 block text-[13px] font-medium text-ink-700">Email</label>
          <div className="relative mb-4">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10 w-full rounded-lg border border-ink-200 pl-9 pr-3 text-sm focus:border-whatsapp-400 focus:outline-none focus:ring-2 focus:ring-whatsapp-100"
              placeholder="you@company.com"
            />
          </div>

          <label className="mb-1 block text-[13px] font-medium text-ink-700">Password</label>
          <div className="relative mb-6">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-10 w-full rounded-lg border border-ink-200 pl-9 pr-3 text-sm focus:border-whatsapp-400 focus:outline-none focus:ring-2 focus:ring-whatsapp-100"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-whatsapp-500 text-sm font-semibold text-white transition-colors hover:bg-whatsapp-600 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-[13px]">
          <Link to="/forgot-password" className="text-ink-500 hover:text-whatsapp-600">Forgot password?</Link>
          <Link to="/register" className="font-medium text-whatsapp-600 hover:underline">Create an account</Link>
        </div>

        <div className="mt-6 rounded-lg border border-whatsapp-200 bg-whatsapp-50 px-4 py-3 text-[12px] text-whatsapp-800">
          <span className="font-semibold">Demo credentials:</span> agent@acme.com / password123
        </div>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [workspaceName, setWorkspaceName] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const setSession = useAuth((s) => s.setSession);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: any; workspace: any }>('/api/auth/register', {
        name,
        email,
        password,
        workspaceName,
      });
      api.setToken(res.token);
      setSession(res.token, res.user, [{ id: res.workspace.id, name: res.workspace.name, slug: res.workspace.slug, companyName: workspaceName, timezone: 'Asia/Kolkata', currency: 'INR', role: 'OWNER' }]);
      toast.success('Account created!');
      navigate('/');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-whatsapp-500 text-white shadow-pop">
            <MessageSquareText className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">Create your workspace</h1>
          <p className="mt-1 text-sm text-ink-500">Start managing your WhatsApp conversations as a CRM.</p>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-ink-200 bg-white p-6 shadow-card">
          <label className="mb-1 block text-[13px] font-medium text-ink-700">Full name</label>
          <div className="relative mb-4">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input value={name} onChange={(e) => setName(e.target.value)} required className="h-10 w-full rounded-lg border border-ink-200 pl-9 pr-3 text-sm focus:border-whatsapp-400 focus:outline-none focus:ring-2 focus:ring-whatsapp-100" placeholder="Rahul Sharma" />
          </div>

          <label className="mb-1 block text-[13px] font-medium text-ink-700">Email</label>
          <div className="relative mb-4">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-10 w-full rounded-lg border border-ink-200 pl-9 pr-3 text-sm focus:border-whatsapp-400 focus:outline-none focus:ring-2 focus:ring-whatsapp-100" placeholder="you@company.com" />
          </div>

          <label className="mb-1 block text-[13px] font-medium text-ink-700">Company / Workspace</label>
          <div className="relative mb-4">
            <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} required className="h-10 w-full rounded-lg border border-ink-200 pl-9 pr-3 text-sm focus:border-whatsapp-400 focus:outline-none focus:ring-2 focus:ring-whatsapp-100" placeholder="Acme Solutions" />
          </div>

          <label className="mb-1 block text-[13px] font-medium text-ink-700">Password</label>
          <div className="relative mb-6">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required className="h-10 w-full rounded-lg border border-ink-200 pl-9 pr-3 text-sm focus:border-whatsapp-400 focus:outline-none focus:ring-2 focus:ring-whatsapp-100" placeholder="At least 8 characters" />
          </div>

          <button type="submit" disabled={loading} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-whatsapp-500 text-sm font-semibold text-white transition-colors hover:bg-whatsapp-600 disabled:opacity-60">
            {loading ? 'Creating…' : 'Create workspace'}
          </button>
        </form>

        <div className="mt-4 text-center text-[13px] text-ink-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-whatsapp-600 hover:underline">Sign in</Link>
        </div>
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('');
  const [step, setStep] = React.useState<'form' | 'done'>('form');
  const [resetToken, setResetToken] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post<{ resetToken?: string }>('/api/auth/forgot-password', { email });
      setResetToken(res.resetToken ?? '');
      setStep('done');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-whatsapp-500 text-white shadow-pop">
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">Reset your password</h1>
          <p className="mt-1 text-sm text-ink-500">
            {step === 'form' ? 'Enter your account email and we will send you a reset link.' : 'Check the steps below to set a new password.'}
          </p>
        </div>

        {step === 'form' ? (
          <form onSubmit={submit} className="rounded-2xl border border-ink-200 bg-white p-6 shadow-card">
            <label className="mb-1 block text-[13px] font-medium text-ink-700">Email</label>
            <div className="relative mb-6">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10 w-full rounded-lg border border-ink-200 pl-9 pr-3 text-sm focus:border-whatsapp-400 focus:outline-none focus:ring-2 focus:ring-whatsapp-100"
                placeholder="you@company.com"
              />
            </div>
            <Button type="submit" disabled={loading} loading={loading} className="w-full">Send reset link</Button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                <ShieldCheck className="h-4 w-4" /> If that email exists, a reset link was generated.
              </div>
              <p className="mt-1 text-[13px] text-emerald-700">In production an email is sent. In demo/dev mode the token is returned below.</p>
            </div>

            {resetToken && (
              <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card">
                <div className="mb-2 text-[13px] font-medium text-ink-700">Demo reset token</div>
                <code className="block break-all rounded-lg bg-ink-50 px-3 py-2.5 text-[12px] text-ink-800">{resetToken}</code>
                <Button
                  className="mt-3 w-full"
                  icon={<ArrowRight className="h-4 w-4" />}
                  onClick={() => navigate(`/reset-password?token=${encodeURIComponent(resetToken)}`)}
                >
                  Continue to reset password
                </Button>
              </div>
            )}

            <button onClick={() => setStep('form')} className="flex w-full items-center justify-center gap-1.5 text-[13px] text-ink-500 hover:text-whatsapp-600">
              <ArrowLeft className="h-4 w-4" /> Try a different email
            </button>
          </div>
        )}

        <div className="mt-4 text-center text-[13px] text-ink-500">
          Remembered your password?{' '}
          <Link to="/login" className="font-medium text-whatsapp-600 hover:underline">Sign in</Link>
        </div>
      </div>
    </div>
  );
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = React.useState(searchParams.get('token') ?? '');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (!token.trim()) {
      toast.error('A reset token is required');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', { token: token.trim(), password });
      toast.success('Password reset — you can now sign in');
      setDone(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 p-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-pop">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">Password updated</h1>
          <p className="mt-2 text-sm text-ink-500">Your password has been reset successfully.</p>
          <Button className="mt-6 w-full" onClick={() => navigate('/login')}>Sign in</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-whatsapp-500 text-white shadow-pop">
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">Set a new password</h1>
          <p className="mt-1 text-sm text-ink-500">Enter your reset token and a new password.</p>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-ink-200 bg-white p-6 shadow-card">
          <label className="mb-1 block text-[13px] font-medium text-ink-700">Reset token</label>
          <div className="relative mb-4">
            <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              className="h-10 w-full rounded-lg border border-ink-200 pl-9 pr-3 font-mono text-sm focus:border-whatsapp-400 focus:outline-none focus:ring-2 focus:ring-whatsapp-100"
              placeholder="Paste the token from your email"
            />
          </div>

          <label className="mb-1 block text-[13px] font-medium text-ink-700">New password</label>
          <div className="relative mb-4">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              className="h-10 w-full rounded-lg border border-ink-200 pl-9 pr-3 text-sm focus:border-whatsapp-400 focus:outline-none focus:ring-2 focus:ring-whatsapp-100"
              placeholder="At least 8 characters"
            />
          </div>

          <label className="mb-1 block text-[13px] font-medium text-ink-700">Confirm password</label>
          <div className="relative mb-6">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
              required
              className="h-10 w-full rounded-lg border border-ink-200 pl-9 pr-3 text-sm focus:border-whatsapp-400 focus:outline-none focus:ring-2 focus:ring-whatsapp-100"
              placeholder="Repeat the password"
            />
          </div>

          <Button type="submit" disabled={loading} loading={loading} className="w-full">Reset password</Button>
        </form>

        <div className="mt-4 text-center text-[13px] text-ink-500">
          <Link to="/forgot-password" className="font-medium text-whatsapp-600 hover:underline">Request a new token</Link>
        </div>
      </div>
    </div>
  );
}