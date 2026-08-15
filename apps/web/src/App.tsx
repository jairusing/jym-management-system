import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthPage } from './features/auth/AuthPage';
import { PasswordResetCallback } from './features/auth/PasswordResetCallback';
import { AuthProvider } from './features/auth/AuthContext';
import { ProfilePage } from './features/auth/ProfilePage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MembersPage } from './features/members/MembersPage';
import { CheckInsPage } from './features/checkins/CheckInsPage';
import { ClassSchedulePage } from './features/classes/ClassSchedulePage';
import { PaymentsPage } from './features/payments/PaymentsPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { MyMembershipPage } from './features/membership/MyMembershipPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/callback" element={<PasswordResetCallback />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<DashboardPage />} />
            <Route path="/app/members" element={<MembersPage />} />
            <Route path="/app/checkins" element={<CheckInsPage />} />
            <Route path="/app/classes" element={<ClassSchedulePage />} />
            <Route path="/app/payments" element={<PaymentsPage />} />
            <Route path="/app/my-membership" element={<MyMembershipPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
          <Route path="/" element={<Navigate to="/auth" replace />} />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}