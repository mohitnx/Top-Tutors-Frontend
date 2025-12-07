import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, MessageSquare, Clock, TrendingUp } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usersApi, messagesApi } from '../../api';
import { User, Conversation, ConversationStatus } from '../../types';
import { Spinner } from '../../components/ui/Loading';

export function AdminDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalConversations: 0,
    pendingConversations: 0,
    activeConversations: 0,
  });
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [pendingConversations, setPendingConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersResponse, conversationsResponse, pendingResponse] = await Promise.all([
          usersApi.getUsers(1, 5),
          messagesApi.getConversations(1, 10),
          messagesApi.getPendingConversations(1, 5),
        ]);

        setRecentUsers(usersResponse.data.data);
        setPendingConversations(pendingResponse.data.data);

        const allConversations = conversationsResponse.data.data;
        setStats({
          totalUsers: usersResponse.data.meta.total,
          totalConversations: conversationsResponse.data.meta.total,
          pendingConversations: pendingResponse.data.meta.total,
          activeConversations: allConversations.filter(
            c => c.status === ConversationStatus.ACTIVE
          ).length,
        });
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Admin Dashboard
        </h1>
        <p className="text-gray-600">
          Welcome back, {user?.name?.split(' ')[0] || 'Admin'}. Here's an overview of the platform.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Total Users"
          value={stats.totalUsers}
          color="primary"
          link="/admin/users"
        />
        <StatCard
          icon={<MessageSquare className="w-5 h-5" />}
          label="Total Conversations"
          value={stats.totalConversations}
          color="violet"
          link="/admin/conversations"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Pending Assignment"
          value={stats.pendingConversations}
          color="amber"
          link="/admin/conversations?status=pending"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Active Sessions"
          value={stats.activeConversations}
          color="emerald"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pending Conversations */}
        <div className="bg-white border border-gray-200 rounded">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="font-bold text-gray-900">Pending Assignments</h2>
            <Link to="/admin/conversations" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View all
            </Link>
          </div>
          
          {pendingConversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No pending conversations
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {pendingConversations.slice(0, 5).map((conv) => (
                <Link
                  key={conv.id}
                  to={`/conversations/${conv.id}`}
                  className="block px-6 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {conv.student?.user.name || 'Unknown Student'}
                      </p>
                      <p className="text-xs text-gray-500">{conv.subject}</p>
                    </div>
                    <span className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded">
                      Pending
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Users */}
        <div className="bg-white border border-gray-200 rounded">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="font-bold text-gray-900">Recent Users</h2>
            <Link to="/admin/users" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View all
            </Link>
          </div>
          
          <div className="divide-y divide-gray-200">
            {recentUsers.map((u) => (
              <div key={u.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{u.name || 'No name'}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  u.role === 'ADMIN' ? 'bg-violet-100 text-violet-700' :
                  u.role === 'TUTOR' ? 'bg-primary-100 text-primary-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {u.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  icon, 
  label, 
  value, 
  color,
  link
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: number; 
  color: 'primary' | 'violet' | 'amber' | 'emerald';
  link?: string;
}) {
  const colors = {
    primary: 'bg-primary-50 text-primary-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };

  const content = (
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );

  if (link) {
    return (
      <Link 
        to={link}
        className="bg-white border border-gray-200 rounded p-4 hover:border-primary-300 hover:shadow-sm transition-all"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded p-4">
      {content}
    </div>
  );
}

export default AdminDashboard;
