import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthPage } from './features/auth/AuthPage';
import { PasswordResetCallback } from './features/auth/PasswordResetCallback';
import { AuthProvider } from './features/auth/AuthContext';
import { ProfilePage } from './features/auth/ProfilePage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PageShell } from './components/ui/PageShell';
import { SectionCard } from './components/ui/SectionCard';
import { ActionLink } from './components/ui/ActionLink';

function DashboardPage() {
  return (
    <PageShell
      eyebrow="Home"
      title="Dashboard"
      description="You are signed in. Build your app here."
    >
      <SectionCard title="Welcome" description="The skeleton is ready.">
        <p className="text-sm text-[#737373]">
          This starter ships auth, a protected shell, the repository pattern, and a tested Supabase setup.
          Add your own features as folders under src/features/.
        </p>
        <div className="mt-6">
          <ActionLink label="Profile" href="/profile" />
        </div>
      </SectionCard>
    </PageShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/callback" element={<PasswordResetCallback />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
          <Route path="/" element={<Navigate to="/auth" replace />} />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}