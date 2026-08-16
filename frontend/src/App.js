import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';

// Pages
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import FleetPage from './pages/FleetPage';
import DriversPage from './pages/DriversPage';
import TripsPage from './pages/TripsPage';
import TrackingPage from './pages/TrackingPage';
import CompliancePage from './pages/CompliancePage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import LoadsPage from './pages/LoadsPage';
import DriverPortalPage from './pages/DriverPortalPage';
import FinancePage from './pages/FinancePage';
import ExpensesPage from './pages/ExpensesPage';

// Layout
import DashboardLayout from './components/DashboardLayout';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(location.state?.user ? true : null);

  useEffect(() => {
    // If user data passed from AuthCallback, skip auth check
    if (location.state?.user) {
      setIsAuthenticated(true);
      return;
    }

    if (!loading) {
      if (user) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        navigate('/');
      }
    }
  }, [user, loading, navigate, location.state]);

  if (loading || isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#426b5f]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return children;
};

const OperationsRoute = ({ children }) => {
  const { user } = useAuth();
  return user?.role === 'driver' ? <Navigate to="/driver" replace /> : children;
};

// App Router Component
const AppRouter = () => {
  const location = useLocation();
  
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/driver" element={<ProtectedRoute><div className="driver-workspace"><DriverPortalPage /></div></ProtectedRoute>} />
      
      {/* Protected Dashboard Routes */}
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <OperationsRoute><DashboardLayout /></OperationsRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="fleet" element={<FleetPage />} />
        <Route path="loads" element={<LoadsPage />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="trips" element={<TripsPage />} />
        <Route path="tracking" element={<TrackingPage />} />
        <Route path="compliance" element={<CompliancePage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Fallback - redirect to landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <AppRouter />
          <Toaster 
            position="top-right" 
            toastOptions={{
              style: {
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#f8fafc',
              },
            }}
          />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

export default App;
