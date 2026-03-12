import { useState, useEffect } from 'react';
import { Search, Trash2 } from 'lucide-react';
import { teachersApi } from '../../api';
import { Teacher, Role } from '../../types';
import { Spinner } from '../../components/ui/Loading';
import { ConfirmModal } from '../../components/ui/Modal';
import Avatar from '../../components/ui/Avatar';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export function AdminTeachers() {
  const { user } = useAuth();
  const isAdmin = user?.role === Role.ADMIN;
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Delete modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTeachers = async () => {
    setIsLoading(true);
    try {
      const data = await teachersApi.getTeachers();
      setTeachers(data);
    } catch (error) {
      console.error('Failed to fetch teachers:', error);
      toast.error('Failed to load teachers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const handleDeleteTeacher = async () => {
    if (!selectedTeacher) return;
    setIsSubmitting(true);
    try {
      await teachersApi.deleteTeacher(selectedTeacher.id);
      toast.success('Teacher removed successfully');
      setIsDeleteModalOpen(false);
      setSelectedTeacher(null);
      fetchTeachers();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to remove teacher');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTeachers = teachers.filter(t =>
    t.users.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.users.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Teachers</h1>
          <p className="text-gray-400">Manage school teachers. Create teachers by adding users with the TEACHER role in the Users page.</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-[#25262b] border border-gray-700/50 rounded mb-6">
        <div className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search teachers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        {/* Teachers Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Spinner size="lg" />
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg font-medium text-gray-300">No teachers found</p>
              <p className="text-sm mt-1">Create users with TEACHER role from the Users page</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-[#2c2d32] border-y border-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Teacher</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">School</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Sections</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Joined</th>
                  {isAdmin && (
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {filteredTeachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-[#2c2d32]">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <Avatar name={teacher.users.name} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-gray-200">{teacher.users.name || 'No name'}</p>
                          <p className="text-xs text-gray-500">{teacher.users.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {teacher.school?.name || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {teacher.teacher_sections?.length || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`badge ${teacher.users.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {teacher.users.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(teacher.createdAt).toLocaleDateString()}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => {
                            setSelectedTeacher(teacher);
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded"
                          title="Remove teacher"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setSelectedTeacher(null); }}
        onConfirm={handleDeleteTeacher}
        title="Remove Teacher"
        message={`Are you sure you want to remove ${selectedTeacher?.users.name || selectedTeacher?.users.email}? This will remove their teacher profile but keep their user account.`}
        confirmText="Remove"
        variant="danger"
        isLoading={isSubmitting}
      />
    </div>
  );
}

export default AdminTeachers;
