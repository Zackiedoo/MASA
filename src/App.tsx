import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { SubjectsProvider } from './contexts/SubjectsContext';
import { AppShell } from './components/navigation/AppShell';
import { Spinner } from './components/shared/States';
import { LoginPanel } from './components/shared/LoginPanel';
import Home from './pages/Home';
import AnnouncementPage from './pages/AnnouncementPage';
import FreedomWall from './pages/FreedomWall';
import Messages from './pages/Messages';
import SubjectGroup from './pages/SubjectGroup';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Legal from './pages/Legal';
import NotFound from './pages/NotFound';

// Heavier, role-specific areas are code-split.
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Publish = lazy(() => import('./pages/Publish'));

/** /login → send people to where they were going (default: Messages). */
function LoginRoute() {
  const { profile, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Spinner />;
  if (profile) return <Navigate to={(loc.state as { from?: string } | null)?.from || '/messages'} replace />;
  return <LoginPanel />;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <SubjectsProvider>
            <Suspense fallback={<Spinner />}>
              <Routes>
                <Route element={<AppShell />}>
                  <Route index element={<Home />} />
                  <Route path="a/:id" element={<AnnouncementPage />} />
                  <Route path="wall" element={<FreedomWall />} />
                  <Route path="messages" element={<Messages />} />
                  <Route path="messages/:subjectId" element={<SubjectGroup />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="login" element={<LoginRoute />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="legal/:doc" element={<Legal />} />
                  <Route path="publish" element={<Publish />} />
                  <Route path="admin" element={<AdminDashboard />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </Suspense>
          </SubjectsProvider>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
