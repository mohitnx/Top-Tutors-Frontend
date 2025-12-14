import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';
import { StudentProfilePage } from './profile/StudentProfile';
import { TutorProfilePage } from './profile/TutorProfile';
import { Loader2 } from 'lucide-react';

// Admin Profile (simple version)
function AdminProfile() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#212121] text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Admin Profile</h1>
        <div className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700/50">
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-500">Name</label>
              <p className="text-lg text-white">{user?.name || 'Admin'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Email</label>
              <p className="text-lg text-white">{user?.email}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Role</label>
              <p className="text-lg text-white">Administrator</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Profile() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#212121] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Route to appropriate profile based on role
  switch (user.role) {
    case Role.STUDENT:
      return <StudentProfilePage />;
    case Role.TUTOR:
      return <TutorProfilePage />;
    case Role.ADMIN:
      return <AdminProfile />;
    default:
      return <StudentProfilePage />;
  }
}

export default Profile;
