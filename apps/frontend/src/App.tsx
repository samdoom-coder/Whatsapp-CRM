import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { Toaster } from '@/components/ui';
import { CommandPalette } from '@/components/command-palette';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { setApiToken } from '@/lib/api';
import { AppShell } from '@/components/layout';
import { useEffect } from 'react';

// Lazy pages
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage } from '@/features/auth/pages';
import { DashboardPage } from '@/features/dashboard/pages';
import { InboxPage } from '@/features/inbox/pages';
import { ContactsPage, ContactDetailPage } from '@/features/contacts/pages';
import { LeadsPage, LeadDetailPage } from '@/features/leads/pages';
import { DealsPage, DealDetailPage } from '@/features/deals/pages';
import { TasksPage } from '@/features/tasks/pages';
import { TemplatesPage } from '@/features/templates/pages';
import { AutomationsPage } from '@/features/automations/pages';
import { AnalyticsPage } from '@/features/analytics/pages';
import { TeamPage } from '@/features/team/pages';
import { SettingsPage } from '@/features/settings/pages';

function ShellRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  useGlobalShortcuts();
  return (
    <AppShell>
      <CommandPalette />
      <div key={location.pathname} className="h-full">
        {children}
      </div>
    </AppShell>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuth((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const token = useAuth((s) => s.token);
  useEffect(() => {
    setApiToken(token);
    if (token) useAuth.getState().connectSocket();
  }, [token]);

  return (
    <>
      <Routes>
        <Route path="/login" element={token ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/register" element={token ? <Navigate to="/" replace /> : <RegisterPage />} />
        <Route path="/forgot-password" element={token ? <Navigate to="/" replace /> : <ForgotPasswordPage />} />
        <Route path="/reset-password" element={token ? <Navigate to="/" replace /> : <ResetPasswordPage />} />

        <Route
          path="/"
          element={
            <RequireAuth>
              <ShellRoute>
                <DashboardPage />
              </ShellRoute>
            </RequireAuth>
          }
        />
        <Route path="/inbox" element={<RequireAuth><ShellRoute><InboxPage /></ShellRoute></RequireAuth>} />
        <Route path="/inbox/:conversationId" element={<RequireAuth><ShellRoute><InboxPage /></ShellRoute></RequireAuth>} />
        <Route path="/contacts" element={<RequireAuth><ShellRoute><ContactsPage /></ShellRoute></RequireAuth>} />
        <Route path="/contacts/:contactId" element={<RequireAuth><ShellRoute><ContactDetailPage /></ShellRoute></RequireAuth>} />
        <Route path="/leads" element={<RequireAuth><ShellRoute><LeadsPage /></ShellRoute></RequireAuth>} />
        <Route path="/leads/:leadId" element={<RequireAuth><ShellRoute><LeadDetailPage /></ShellRoute></RequireAuth>} />
        <Route path="/deals" element={<RequireAuth><ShellRoute><DealsPage /></ShellRoute></RequireAuth>} />
        <Route path="/deals/:dealId" element={<RequireAuth><ShellRoute><DealDetailPage /></ShellRoute></RequireAuth>} />
        <Route path="/tasks" element={<RequireAuth><ShellRoute><TasksPage /></ShellRoute></RequireAuth>} />
        <Route path="/templates" element={<RequireAuth><ShellRoute><TemplatesPage /></ShellRoute></RequireAuth>} />
        <Route path="/automations" element={<RequireAuth><ShellRoute><AutomationsPage /></ShellRoute></RequireAuth>} />
        <Route path="/analytics" element={<RequireAuth><ShellRoute><AnalyticsPage /></ShellRoute></RequireAuth>} />
        <Route path="/team" element={<RequireAuth><ShellRoute><TeamPage /></ShellRoute></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><ShellRoute><SettingsPage /></ShellRoute></RequireAuth>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  );
}