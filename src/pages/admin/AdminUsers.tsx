import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Mail, Building2 } from 'lucide-react';
import { usersApi, schoolsApi } from '../../api';
import { School } from '../../api/schools';
import { User, Role } from '../../types';
import { Spinner } from '../../components/ui/Loading';
import { NoUsers } from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import Avatar from '../../components/ui/Avatar';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const ROLE_BADGE: Record<string, string> = {
  ADMIN: 'bg-violet-500/10 text-violet-400',
  ADMINISTRATOR: 'bg-violet-500/10 text-violet-400',
  TEACHER: 'bg-amber-500/10 text-amber-400',
  TUTOR: 'bg-primary-500/10 text-primary-400',
  STUDENT: 'bg-gray-700/50 text-gray-300',
};

export function AdminUsers() {
  const { user: authUser } = useAuth();
  const isAdmin = authUser?.role === Role.ADMIN;

  const [users, setUsers] = useState<User[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await usersApi.getUsers(page, 15);
      if (Array.isArray(response)) {
        setUsers(response);
        setTotalPages(1);
      } else {
        setUsers(response.data || []);
        setTotalPages(response.total ? Math.ceil(response.total / (response.limit || 15)) : 1);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSchools = async () => {
    // Only ADMIN needs school list for the create form
    if (!isAdmin) return;
    try {
      const data = await schoolsApi.getSchools();
      setSchools(data);
    } catch {
      console.error('Failed to fetch schools');
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchSchools();
  }, [page]);

  const handleCreateUser = async (data: { name: string; email: string; role: string; schoolId?: string }) => {
    setIsSubmitting(true);
    try {
      await usersApi.createUser(data as Parameters<typeof usersApi.createUser>[0]);
      toast.success('User created — invitation email sent!');
      setIsCreateModalOpen(false);
      fetchUsers();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async (data: { name?: string; isActive?: boolean }) => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      await usersApi.updateUser(selectedUser.id, data);
      toast.success('User updated successfully');
      setIsEditModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    try {
      await usersApi.deleteUser(selectedUser.id);
      toast.success('User deleted successfully');
      setIsDeleteModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to delete user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendInvitation = async (userId: string) => {
    setResendingId(userId);
    try {
      await usersApi.resendInvitation(userId);
      toast.success('Invitation email resent');
    } catch {
      toast.error('Failed to resend invitation');
    } finally {
      setResendingId(null);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Role filter options differ by viewer role
  const roleFilterOptions = isAdmin
    ? ['ALL', 'ADMIN', 'ADMINISTRATOR', 'TEACHER', 'TUTOR', 'STUDENT']
    : ['ALL', 'TEACHER', 'STUDENT'];

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Users</h1>
          <p className="text-gray-400">
            {isAdmin
              ? 'Manage all platform users — administrators, teachers, tutors, and students'
              : 'Manage teachers and students in your school'}
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setIsCreateModalOpen(true)}>
          {isAdmin ? 'Add User' : 'Add Teacher / Student'}
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-[#25262b] border border-gray-700/50 rounded mb-6">
        <div className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="input w-auto"
          >
            {roleFilterOptions.map(role => (
              <option key={role} value={role}>
                {role === 'ALL' ? 'All Roles' : role.charAt(0) + role.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
          ) : filteredUsers.length === 0 ? (
            <NoUsers />
          ) : (
            <table className="w-full">
              <thead className="bg-[#2c2d32] border-y border-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-[#2c2d32]">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-gray-200">{user.name || 'No name'}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`badge ${ROLE_BADGE[user.role] || 'bg-gray-700/50 text-gray-300'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`badge ${user.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'}`}>
                        {user.isActive ? 'Active' : 'Pending Invite'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Resend invitation for inactive users — both ADMIN and ADMINISTRATOR */}
                        {!user.isActive && (
                          <button
                            onClick={() => handleResendInvitation(user.id)}
                            disabled={resendingId === user.id}
                            className="p-1.5 text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 rounded disabled:opacity-50"
                            title="Resend invitation"
                          >
                            <Mail className={`w-4 h-4 ${resendingId === user.id ? 'animate-pulse' : ''}`} />
                          </button>
                        )}
                        {/* Edit & Delete — ADMIN only */}
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => { setSelectedUser(user); setIsEditModalOpen(true); }}
                              className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { setSelectedUser(user); setIsDeleteModalOpen(true); }}
                              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-700/50">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateUser}
        isLoading={isSubmitting}
        schools={schools}
        isAdmin={isAdmin}
      />

      {/* Edit User Modal — ADMIN only */}
      {isAdmin && selectedUser && (
        <EditUserModal
          isOpen={isEditModalOpen}
          onClose={() => { setIsEditModalOpen(false); setSelectedUser(null); }}
          onSubmit={handleUpdateUser}
          user={selectedUser}
          isLoading={isSubmitting}
        />
      )}

      {/* Delete Confirmation Modal — ADMIN only */}
      {isAdmin && (
        <ConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={() => { setIsDeleteModalOpen(false); setSelectedUser(null); }}
          onConfirm={handleDeleteUser}
          title="Delete User"
          message={`Are you sure you want to delete ${selectedUser?.name || selectedUser?.email}? This action cannot be undone.`}
          confirmText="Delete"
          variant="danger"
          isLoading={isSubmitting}
        />
      )}
    </div>
  );
}

// ─── Role descriptions for the create form ───
// ADMIN sees all 4 roles; ADMINISTRATOR sees only TEACHER and STUDENT
const ADMIN_ROLE_INFO: Record<string, { description: string; needsSchool: 'required' | 'optional' | 'none' }> = {
  STUDENT: { description: 'A student who can ask questions and receive tutoring', needsSchool: 'optional' },
  TEACHER: { description: 'A school teacher who uploads daily question papers', needsSchool: 'required' },
  TUTOR: { description: 'An independent tutor who answers student questions live', needsSchool: 'none' },
  ADMINISTRATOR: { description: 'A school administrator who manages their school', needsSchool: 'required' },
};

const ADMINISTRATOR_ROLE_INFO: Record<string, { description: string; needsSchool: 'none' }> = {
  TEACHER: { description: 'A school teacher who uploads daily question papers', needsSchool: 'none' },
  STUDENT: { description: 'A student who can ask questions and receive tutoring', needsSchool: 'none' },
};

// ─── Create User Modal ───
function CreateUserModal({
  isOpen, onClose, onSubmit, isLoading, schools, isAdmin,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; email: string; role: string; schoolId?: string }) => void;
  isLoading: boolean;
  schools: School[];
  isAdmin: boolean;
}) {
  const roleInfo = isAdmin ? ADMIN_ROLE_INFO : ADMINISTRATOR_ROLE_INFO;
  const defaultRole = isAdmin ? 'STUDENT' : 'TEACHER';

  const [formData, setFormData] = useState({ name: '', email: '', role: defaultRole, schoolId: '' });

  // Reset form on open
  useEffect(() => {
    if (isOpen) setFormData({ name: '', email: '', role: defaultRole, schoolId: '' });
  }, [isOpen]);

  const currentRoleInfo = roleInfo[formData.role];
  const showSchool = isAdmin && currentRoleInfo && 'needsSchool' in currentRoleInfo && (currentRoleInfo as { needsSchool: string }).needsSchool !== 'none';
  const schoolRequired = isAdmin && currentRoleInfo && 'needsSchool' in currentRoleInfo && (currentRoleInfo as { needsSchool: string }).needsSchool === 'required';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (schoolRequired && !formData.schoolId) {
      toast.error('School is required for this role');
      return;
    }
    const data: { name: string; email: string; role: string; schoolId?: string } = {
      name: formData.name,
      email: formData.email,
      role: formData.role,
    };
    // Only ADMIN sends schoolId; ADMINISTRATOR has it auto-filled by backend
    if (isAdmin && showSchool && formData.schoolId) {
      data.schoolId = formData.schoolId;
    }
    onSubmit(data);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isAdmin ? 'Create New User' : 'Add Teacher or Student'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Role Selection */}
        <div>
          <label className="label">Role</label>
          <div className={`grid gap-2 ${Object.keys(roleInfo).length > 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
            {Object.entries(roleInfo).map(([role, info]) => (
              <button
                key={role}
                type="button"
                onClick={() => setFormData({ ...formData, role, schoolId: '' })}
                className={`text-left p-3 rounded-lg border transition-all ${
                  formData.role === role
                    ? 'border-primary-500 bg-primary-500/10 ring-1 ring-primary-500'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                <span className={`text-sm font-medium ${formData.role === role ? 'text-primary-400' : 'text-gray-200'}`}>
                  {role === 'ADMINISTRATOR' ? 'School Admin' : role.charAt(0) + role.slice(1).toLowerCase()}
                </span>
                <p className="text-xs text-gray-500 mt-0.5">{info.description}</p>
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Full Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          placeholder="e.g. John Smith"
        />

        <Input
          label="Email Address"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
          placeholder="e.g. john@school.edu"
        />

        {/* School Dropdown — ADMIN only */}
        {showSchool && (
          <div>
            <label className="label flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              School {schoolRequired ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">(optional)</span>}
            </label>
            <select
              value={formData.schoolId}
              onChange={(e) => setFormData({ ...formData, schoolId: e.target.value })}
              className="input"
              required={schoolRequired}
            >
              <option value="">{schoolRequired ? 'Select a school' : 'No school (independent)'}</option>
              {schools.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
            {schools.length === 0 && (
              <p className="text-xs text-amber-400 mt-1">No schools found. Create a school first from the Schools page.</p>
            )}
          </div>
        )}

        {/* Info banner */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
          <p className="text-xs text-blue-400">
            An invitation email will be sent to <strong>{formData.email || 'the user'}</strong> to set their password.
            {!isAdmin && ' The user will be automatically linked to your school.'}
          </p>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button type="submit" isLoading={isLoading}>Create & Send Invite</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit User Modal (ADMIN only) ───
function EditUserModal({
  isOpen, onClose, onSubmit, user, isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name?: string; isActive?: boolean }) => void;
  user: User;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    name: user.name || '',
    isActive: user.isActive,
  });

  useEffect(() => {
    setFormData({ name: user.name || '', isActive: user.isActive });
  }, [user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: { name?: string; isActive?: boolean } = {};
    if (formData.name !== (user.name || '')) updates.name = formData.name;
    if (formData.isActive !== user.isActive) updates.isActive = formData.isActive;
    onSubmit(updates);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit User">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`badge ${ROLE_BADGE[user.role] || 'bg-gray-700/50 text-gray-300'}`}>{user.role}</span>
          <span className="text-sm text-gray-400">{user.email}</span>
        </div>
        <Input label="Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            className="w-4 h-4 text-primary-600 border-gray-600 bg-[#2c2d32] rounded focus:ring-primary-500"
          />
          <label htmlFor="isActive" className="text-sm text-gray-300">Active account</label>
        </div>
        <div className="flex gap-3 justify-end pt-4">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button type="submit" isLoading={isLoading}>Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
}

export default AdminUsers;
