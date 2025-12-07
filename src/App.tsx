import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { Layout, AuthLayout, PublicLayout, ProtectedRoute } from './components/layout';
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
  AskQuestion,
  Conversations,
  Chat,
  Profile,
  NotFound,
  Unauthorized,
} from './pages';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fff',
              color: '#333',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              fontSize: '14px',
              fontFamily: 'Lato, sans-serif',
            },
            success: {
              iconTheme: {
                primary: '#14bf96',
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

        <Routes>
          {/* Public Routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Landing />} />
          </Route>

          {/* Auth Routes (no sidebar) */}
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
            <Route path="/ask" element={<AskQuestion />} />
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

          {/* Redirects */}
          <Route path="/dashboard" element={<Navigate to="/dashboard/student" replace />} />

          {/* 404 */}
          <Route element={<AuthLayout />}>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
