import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import DeviceLink from './pages/DeviceLink.jsx';
import Templates from './pages/Templates.jsx';
import Contacts from './pages/Contacts.jsx';
import SendMessage from './pages/SendMessage.jsx';
import ChatbotBuilder from './pages/ChatbotBuilder.jsx';
import Terms from './pages/Terms.jsx';
import SuperAdmin from './pages/SuperAdmin.jsx';
import ApiPage from './pages/ApiPage.jsx';
import WebsiteData from './pages/WebsiteData.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import PricingPage from './pages/PricingPage.jsx';
import { Clock } from 'lucide-react';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
}

function PendingApproval() {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center">
        <Clock size={48} className="mx-auto text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Account Pending Approval</h2>
        <p className="text-gray-500 text-sm mb-6">
          Your account has been created successfully. Please wait for the admin to approve your account before you can access the platform.
        </p>
        <button onClick={logout} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm">
          Logout
        </button>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user } = useAuth();
  const pages = user?.allowed_pages || [];
  const isSuperAdmin = user?.is_superadmin;

  // If not approved and not superadmin, show pending
  if (!user.is_approved && !isSuperAdmin) {
    return <PendingApproval />;
  }

  return (
    <Layout>
      <Routes>
        {/* Always show dashboard as fallback */}
        <Route path="/" element={<Dashboard />} />

        {/* Only show routes user has permission for */}
        {(isSuperAdmin || pages.includes('device')) && <Route path="/device" element={<DeviceLink />} />}
        {(isSuperAdmin || pages.includes('templates')) && <Route path="/templates" element={<Templates />} />}
        {(isSuperAdmin || pages.includes('contacts')) && <Route path="/contacts" element={<Contacts />} />}
        {(isSuperAdmin || pages.includes('send')) && <Route path="/send" element={<SendMessage />} />}
        {(isSuperAdmin || pages.includes('chatbot')) && <Route path="/chatbot" element={<ChatbotBuilder />} />}
        {(isSuperAdmin || pages.includes('api')) && <Route path="/api" element={<ApiPage />} />}
        <Route path="/website-data" element={<WebsiteData />} />

        {/* Profile & Settings - always accessible */}
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />

        {/* Super Admin route */}
        {isSuperAdmin && <Route path="/admin" element={<SuperAdmin />} />}

        {/* Catch-all: redirect to dashboard */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/terms" element={<Terms />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppRoutes />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
