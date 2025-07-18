import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/auth.store';
import { ThemeProvider } from './providers/theme-provider';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import PriceMatchingNew from './pages/PriceMatchingNew';
import PriceList from './pages/PriceList';
import Projects from './pages/Projects';
import Clients from './pages/Clients';
import AdminSettings from './pages/AdminSettings';
import Profile from './pages/Profile';
import UserSettings from './pages/UserSettings';
import Activity from './pages/Activity';
import { queryClient } from './lib/query-config';
import { useTokenRefresh } from './hooks/useTokenRefresh';
import './styles/animations.css';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return user?.role === 'admin' ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  useTokenRefresh();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" storageKey="tfp-theme">
        <QueryClientProvider client={queryClient}>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Layout />
                  </PrivateRoute>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="price-matching" element={<PriceMatchingNew />} />
                <Route path="price-list" element={<PriceList />} />
                <Route path="projects" element={<Projects />} />
                <Route path="clients" element={<Clients />} />
                <Route path="activity" element={<Activity />} />
                <Route path="profile" element={<Profile />} />
                <Route path="settings" element={<UserSettings />} />
                <Route
                  path="admin"
                  element={
                    <AdminRoute>
                      <AdminSettings />
                    </AdminRoute>
                  }
                />
              </Route>
            </Routes>
            <Toaster position="top-right" />
          </Router>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;