import { useState } from 'react';
import { User, Mail, Shield, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';

export function Profile() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  const roleColors: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-800',
    TUTOR: 'bg-blue-100 text-blue-800',
    STUDENT: 'bg-green-100 text-green-800',
  };

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>

        {/* Profile Card */}
        <div className="bg-white border border-gray-200 rounded">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <Avatar name={user.name} size="lg" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {user.name || 'No name set'}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`badge ${roleColors[user.role] || 'bg-gray-100 text-gray-700'}`}>
                    {user.role}
                  </span>
                  <span className={`badge ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-6 space-y-4">
            <ProfileField
              icon={<User className="w-5 h-5" />}
              label="Full Name"
              value={user.name || 'Not set'}
            />
            <ProfileField
              icon={<Mail className="w-5 h-5" />}
              label="Email"
              value={user.email}
            />
            <ProfileField
              icon={<Shield className="w-5 h-5" />}
              label="Role"
              value={user.role}
            />
            <ProfileField
              icon={<Calendar className="w-5 h-5" />}
              label="Joined"
              value={new Date(user.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            />
          </div>
        </div>

        {/* Account Security Note */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> To change your password or update account security settings, 
            please contact support.
          </p>
        </div>
      </div>
    </div>
  );
}

function ProfileField({ 
  icon, 
  label, 
  value 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-gray-500 flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}

export default Profile;




