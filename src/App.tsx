import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { CallProvider } from './contexts/CallContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { Layout, AuthLayout, PublicLayout, ProtectedRoute } from './components/layout';
import { IncomingCallModal } from './components/call';
import { Role } from './types';

// Pages
import {
  Landing,
  Login,
  Register,
  AuthCallback,
  StudentDashboard,
  TutorDashboard,
  AdminDashboard,
  AdminUsers,
  AdminConversations,
  Conversations,
  Chat,
  Profile,
  NotFound,
  Unauthorized,
  SharedConversation,
} from './pages';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CallProvider>
          <NotificationProvider>
          {/* Toast Notifications - Dark theme */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#2a2a2a',
                color: '#fff',
                border: '1px solid #3a3a3a',
                borderRadius: '12px',
                fontSize: '14px',
                fontFamily: 'Lato, sans-serif',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />

          {/* Global Incoming Call Modal */}
          <IncomingCallModal />

          <Routes>
          {/* Public Routes - Landing with Auth */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Landing />} />
          </Route>

          {/* Auth Routes - Redirect to Landing */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
          </Route>

          {/* Student Routes */}
          <Route
            element={
              <ProtectedRoute allowedRoles={[Role.STUDENT]}>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard/student" element={<StudentDashboard />} />
            {/* /ask now redirects to dashboard since questions are asked from there */}
            <Route path="/ask" element={<Navigate to="/dashboard/student" replace />} />
          </Route>

          {/* Tutor Routes */}
          <Route
            element={
              <ProtectedRoute allowedRoles={[Role.TUTOR]}>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard/tutor" element={<TutorDashboard />} />
          </Route>

          {/* Admin Routes */}
          <Route
            element={
              <ProtectedRoute allowedRoles={[Role.ADMIN]}>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/conversations" element={<AdminConversations />} />
          </Route>

          {/* Shared Protected Routes (Student & Tutor) */}
          <Route
            element={
              <ProtectedRoute allowedRoles={[Role.STUDENT, Role.TUTOR]}>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/conversations" element={<Conversations />} />
            <Route path="/conversations/:id" element={<Chat />} />
          </Route>

          {/* Profile (All authenticated users) */}
          <Route
            element={
              <ProtectedRoute allowedRoles={[Role.STUDENT, Role.TUTOR, Role.ADMIN]}>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* Shared Conversation - Public route (accessible to anyone) */}
          <Route path="/shared/:shareToken" element={<SharedConversation />} />

          {/* Redirects */}
          <Route path="/dashboard" element={<Navigate to="/dashboard/student" replace />} />

          {/* 404 */}
          <Route element={<AuthLayout />}>
            <Route path="*" element={<NotFound />} />
          </Route>
          </Routes>
          </NotificationProvider>
        </CallProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
