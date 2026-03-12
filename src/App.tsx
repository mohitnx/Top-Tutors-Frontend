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
  AcceptInvitation,
  StudentDashboard,
  StudentPackages,
  ProjectsList,
  ProjectDetail,
  TeacherDashboard,
  TutorDashboard,
  AdminDashboard,
  AdminUsers,
  AdminSchools,
  AdminConversations,
  AdminTeachers,
  AdminSections,
  AdminDailyPackages,
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

          {/* Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
          </Route>

          {/* Accept Invitation - Public, standalone page */}
          <Route path="/accept-invitation" element={<AcceptInvitation />} />

          {/* Student Routes */}
          <Route
            element={
              <ProtectedRoute allowedRoles={[Role.STUDENT]}>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard/student" element={<StudentDashboard />} />
            <Route path="/student/packages" element={<StudentPackages />} />
            <Route path="/projects" element={<ProjectsList />} />
            <Route path="/projects/:projectId" element={<ProjectDetail />} />
            <Route path="/ask" element={<Navigate to="/dashboard/student" replace />} />
          </Route>

          {/* Teacher Routes */}
          <Route
            element={
              <ProtectedRoute allowedRoles={[Role.TEACHER]}>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard/teacher" element={<TeacherDashboard />} />
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

          {/* Admin-only Routes (ADMIN only — Schools, Conversations) */}
          <Route
            element={
              <ProtectedRoute allowedRoles={[Role.ADMIN]}>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/admin/schools" element={<AdminSchools />} />
            <Route path="/admin/conversations" element={<AdminConversations />} />
          </Route>

          {/* Administrator-only Routes (school subjects/sections) */}
          <Route
            element={
              <ProtectedRoute allowedRoles={[Role.ADMINISTRATOR]}>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/admin/sections" element={<AdminSections />} />
            <Route path="/admin/daily-packages" element={<AdminDailyPackages />} />
          </Route>

          {/* Admin + Administrator shared routes */}
          <Route
            element={
              <ProtectedRoute allowedRoles={[Role.ADMIN, Role.ADMINISTRATOR]}>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/teachers" element={<AdminTeachers />} />
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
              <ProtectedRoute allowedRoles={[Role.STUDENT, Role.TEACHER, Role.TUTOR, Role.ADMIN, Role.ADMINISTRATOR]}>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* Shared Conversation - Public route */}
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
