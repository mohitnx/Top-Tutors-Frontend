import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Users, GraduationCap, UserPlus, UserMinus, ChevronLeft } from 'lucide-react';
import { sectionsApi, teachersApi, schoolsApi } from '../../api';
import { ClassSection, Teacher, Subject } from '../../types';
import { SchoolStudent } from '../../api/schools';
import { Spinner } from '../../components/ui/Loading';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import toast from 'react-hot-toast';

const SUBJECT_OPTIONS = Object.values(Subject).map(s => ({
  value: s,
  label: s.replace(/_/g, ' '),
}));

export function AdminSections() {

  const [sections, setSections] = useState<ClassSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Detail view
  const [selectedSection, setSelectedSection] = useState<ClassSection | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAssignTeacherOpen, setIsAssignTeacherOpen] = useState(false);
  const [isAddStudentsOpen, setIsAddStudentsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reference data
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  const fetchSections = async () => {
    setIsLoading(true);
    try {
      const data = await sectionsApi.getSections();
      setSections(data);
    } catch {
      toast.error('Failed to load sections');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSectionDetail = async (id: string) => {
    setIsLoadingDetail(true);
    try {
      const detail = await sectionsApi.getSection(id);
      setSelectedSection(detail);
    } catch {
      toast.error('Failed to load section details');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const data = await teachersApi.getTeachers();
      setTeachers(data);
    } catch {
      console.error('Failed to fetch teachers');
    }
  };

  useEffect(() => {
    fetchSections();
    fetchTeachers();
  }, []);

  // --- Handlers ---

  const handleCreateSection = async (data: { name: string; grade?: string }) => {
    setIsSubmitting(true);
    try {
      await sectionsApi.createSection(data);
      toast.success('Section created');
      setIsCreateModalOpen(false);
      fetchSections();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to create section');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSection = async (data: { name?: string; grade?: string }) => {
    if (!selectedSection) return;
    setIsSubmitting(true);
    try {
      await sectionsApi.updateSection(selectedSection.id, data);
      toast.success('Section updated');
      setIsEditModalOpen(false);
      fetchSections();
      fetchSectionDetail(selectedSection.id);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to update section');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSection = async () => {
    if (!selectedSection) return;
    setIsSubmitting(true);
    try {
      await sectionsApi.deleteSection(selectedSection.id);
      toast.success('Section deleted');
      setIsDeleteModalOpen(false);
      setSelectedSection(null);
      fetchSections();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to delete section');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignTeacher = async (teacherId: string, subject: string) => {
    if (!selectedSection) return;
    setIsSubmitting(true);
    try {
      await sectionsApi.assignTeacher(selectedSection.id, teacherId, subject);
      toast.success('Subject assigned to teacher');
      setIsAssignTeacherOpen(false);
      fetchSectionDetail(selectedSection.id);
      fetchSections();
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } } };
      if (err.response?.status === 409) {
        toast.error('This teacher is already assigned with this subject');
      } else {
        toast.error(err.response?.data?.message || 'Failed to assign teacher');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddStudents = async (studentIds: string[]) => {
    if (!selectedSection) return;
    setIsSubmitting(true);
    try {
      const result = await sectionsApi.addStudents(selectedSection.id, studentIds);
      toast.success(`${result.added} student(s) added`);
      setIsAddStudentsOpen(false);
      fetchSectionDetail(selectedSection.id);
      fetchSections();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to add students');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!selectedSection) return;
    try {
      await sectionsApi.removeStudent(selectedSection.id, studentId);
      toast.success('Student removed');
      fetchSectionDetail(selectedSection.id);
      fetchSections();
    } catch {
      toast.error('Failed to remove student');
    }
  };

  const filteredSections = sections.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.grade || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- Detail View ---
  if (selectedSection && !isEditModalOpen && !isDeleteModalOpen) {
    return (
      <SectionDetailView
        section={selectedSection}
        isLoading={isLoadingDetail}
        onBack={() => setSelectedSection(null)}
        onEdit={() => setIsEditModalOpen(true)}
        onDelete={() => setIsDeleteModalOpen(true)}
        onAssignTeacher={() => setIsAssignTeacherOpen(true)}
        onAddStudents={() => setIsAddStudentsOpen(true)}
        onRemoveStudent={handleRemoveStudent}
      >
        {/* Edit Modal */}
        <EditSectionModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSubmit={handleUpdateSection}
          section={selectedSection}
          isLoading={isSubmitting}
        />

        {/* Delete Confirmation */}
        <ConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleDeleteSection}
          title="Delete Section"
          message={`Are you sure you want to delete "${selectedSection.name}"? This will remove all teacher and student assignments. This action cannot be undone.`}
          confirmText="Delete"
          variant="danger"
          isLoading={isSubmitting}
        />

        {/* Assign Teacher Modal */}
        <AssignTeacherModal
          isOpen={isAssignTeacherOpen}
          onClose={() => setIsAssignTeacherOpen(false)}
          onSubmit={handleAssignTeacher}
          teachers={teachers}
          isLoading={isSubmitting}
        />

        {/* Add Students Modal */}
        {selectedSection && (
          <AddStudentsModal
            isOpen={isAddStudentsOpen}
            onClose={() => setIsAddStudentsOpen(false)}
            onSubmit={handleAddStudents}
            schoolId={selectedSection.schoolId}
            existingStudentIds={(selectedSection.student_sections || []).map(ss => ss.studentId)}
            isLoading={isSubmitting}
          />
        )}
      </SectionDetailView>
    );
  }

  // --- List View ---
  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Subjects & Sections</h1>
          <p className="text-gray-400">Create sections (e.g. 10A, 10B), then assign subjects to teachers</p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setIsCreateModalOpen(true)}>
          Create Section
        </Button>
      </div>

      {/* Search */}
      <div className="bg-[#25262b] border border-gray-700/50 rounded mb-6">
        <div className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by section name or grade..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm bg-[#2c2d32] border border-gray-700/50 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-primary-500/50"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
          ) : filteredSections.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium">No sections found</p>
              <p className="text-sm mt-1">Create a section (e.g. 10A) and assign subjects to teachers</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-[#2c2d32] border-y border-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Section</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Grade</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Subjects</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Students</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {filteredSections.map((section) => (
                  <tr
                    key={section.id}
                    className="hover:bg-[#2c2d32] cursor-pointer"
                    onClick={() => fetchSectionDetail(section.id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-200">{section.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{section.grade || '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {section._count?.teacher_sections ?? 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {section._count?.student_sections ?? 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => fetchSectionDetail(section.id)}
                          className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded"
                          title="View details"
                        >
                          <Users className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setSelectedSection(section); setIsDeleteModalOpen(true); }}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Section Modal */}
      <CreateSectionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateSection}
        isLoading={isSubmitting}
      />

      {/* Delete (from list view) */}
      {selectedSection && (
        <ConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={() => { setIsDeleteModalOpen(false); setSelectedSection(null); }}
          onConfirm={handleDeleteSection}
          title="Delete Section"
          message={`Are you sure you want to delete "${selectedSection.name}"? This action cannot be undone.`}
          confirmText="Delete"
          variant="danger"
          isLoading={isSubmitting}
        />
      )}
    </div>
  );
}

// ============================================
// Section Detail View
// ============================================

function SectionDetailView({
  section,
  isLoading,
  onBack,
  onEdit,
  onDelete,
  onAssignTeacher,
  onAddStudents,
  onRemoveStudent,
  children,
}: {
  section: ClassSection;
  isLoading: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAssignTeacher: () => void;
  onAddStudents: () => void;
  onRemoveStudent: (studentId: string) => void;
  children: React.ReactNode;
}) {
  const teacherSections = section.teacher_sections || [];
  const studentSections = section.student_sections || [];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-1.5 hover:bg-[#2c2d32] rounded-lg">
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-100">{section.name}</h1>
          <p className="text-gray-500 text-sm">
            {section.school?.name && <span>{section.school.name}</span>}
            {section.grade && <span> &middot; Grade {section.grade}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" leftIcon={<Edit2 className="w-3.5 h-3.5" />} onClick={onEdit}>
            Edit
          </Button>
          <Button variant="danger" size="sm" leftIcon={<Trash2 className="w-3.5 h-3.5" />} onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Teachers Card */}
          <div className="bg-[#25262b] border border-gray-700/50 rounded-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/50">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-gray-400" />
                <h2 className="font-semibold text-gray-100">Subjects & Teachers ({teacherSections.length})</h2>
              </div>
              <Button size="sm" variant="secondary" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={onAssignTeacher}>
                Assign Subject
              </Button>
            </div>
            <div className="p-4">
              {teacherSections.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">No subjects assigned yet. Assign a subject and teacher.</p>
              ) : (
                <div className="space-y-2">
                  {teacherSections.map((ts, i) => (
                    <div key={`${ts.teacherId}-${ts.subject}-${i}`} className="flex items-center justify-between p-3 bg-[#2c2d32] rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs font-semibold min-w-[80px] justify-center">
                          {(ts.subject || 'GENERAL').replace(/_/g, ' ')}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-gray-200">
                            {ts.teachers?.users?.name || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500">{ts.teachers?.users?.email}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Students Card */}
          <div className="bg-[#25262b] border border-gray-700/50 rounded-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/50">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-400" />
                <h2 className="font-semibold text-gray-100">Students ({studentSections.length})</h2>
              </div>
              <Button size="sm" variant="secondary" leftIcon={<UserPlus className="w-3.5 h-3.5" />} onClick={onAddStudents}>
                Add
              </Button>
            </div>
            <div className="p-4">
              {studentSections.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">No students in this section</p>
              ) : (
                <div className="space-y-2">
                  {studentSections.map((ss) => (
                    <div key={ss.studentId} className="flex items-center justify-between p-3 bg-[#2c2d32] rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-200">
                          {ss.students?.users?.name || 'No name'}
                        </p>
                        <p className="text-xs text-gray-500">{ss.students?.users?.email}</p>
                      </div>
                      <button
                        onClick={() => onRemoveStudent(ss.studentId)}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded"
                        title="Remove student"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {children}
    </div>
  );
}

// ============================================
// Create Section Modal
// ============================================

function CreateSectionModal({
  isOpen, onClose, onSubmit, isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; grade?: string }) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setGrade('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, grade: grade || undefined });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Section">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Grade"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          required
          placeholder="e.g. 10"
        />
        <Input
          label="Section Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. 10A"
        />
        <p className="text-xs text-gray-500 -mt-2">Create one section per class group (e.g. 10A, 10B). Then assign subjects and teachers.</p>
        <div className="flex gap-3 justify-end pt-4">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button type="submit" isLoading={isLoading}>Create Section</Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================
// Edit Section Modal
// ============================================

function EditSectionModal({
  isOpen, onClose, onSubmit, section, isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name?: string; grade?: string }) => void;
  section: ClassSection;
  isLoading: boolean;
}) {
  const [name, setName] = useState(section.name);
  const [grade, setGrade] = useState(section.grade || '');

  useEffect(() => {
    setName(section.name);
    setGrade(section.grade || '');
  }, [section]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, grade: grade || undefined });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Section Details">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Section Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Grade" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. Grade 10" />
        <div className="flex gap-3 justify-end pt-4">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button type="submit" isLoading={isLoading}>Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================
// Assign Teacher Modal
// ============================================

function AssignTeacherModal({
  isOpen, onClose, onSubmit, teachers, isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (teacherId: string, subject: string) => void;
  teachers: Teacher[];
  isLoading: boolean;
}) {
  const [teacherId, setTeacherId] = useState('');
  const [subject, setSubject] = useState('MATHEMATICS');

  useEffect(() => {
    if (isOpen) {
      setTeacherId('');
      setSubject('MATHEMATICS');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId) return;
    onSubmit(teacherId, subject);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign Subject & Teacher">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Subject</label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="input"
            required
          >
            {SUBJECT_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Teacher</label>
          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className="input"
            required
          >
            <option value="">Select a teacher</option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>
                {t.users.name || t.users.email}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-3 justify-end pt-4">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button type="submit" isLoading={isLoading} disabled={!teacherId}>Assign</Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================
// Add Students Modal
// ============================================

function AddStudentsModal({
  isOpen, onClose, onSubmit, schoolId, existingStudentIds, isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (studentIds: string[]) => void;
  schoolId: string;
  existingStudentIds: string[];
  isLoading: boolean;
}) {
  const [students, setStudents] = useState<SchoolStudent[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen && schoolId) {
      setIsLoadingStudents(true);
      setSelected(new Set());
      setSearch('');
      schoolsApi.getSchoolStudents(schoolId)
        .then(setStudents)
        .catch(() => toast.error('Failed to load students'))
        .finally(() => setIsLoadingStudents(false));
    }
  }, [isOpen, schoolId]);

  const availableStudents = students.filter(
    s => !existingStudentIds.includes(s.id)
  );

  const filteredStudents = availableStudents.filter(s => {
    const q = search.toLowerCase();
    const name = s.name || s.users?.name || '';
    const email = s.email || s.users?.email || '';
    return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
  });

  const toggleStudent = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    if (selected.size === 0) return;
    onSubmit(Array.from(selected));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Students to Section" size="lg">
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>

        <div className="max-h-64 overflow-y-auto border border-gray-700/50 rounded-lg">
          {isLoadingStudents ? (
            <div className="flex items-center justify-center py-8"><Spinner /></div>
          ) : filteredStudents.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              {availableStudents.length === 0 ? 'All students are already in this section' : 'No students match your search'}
            </p>
          ) : (
            filteredStudents.map(s => (
              <label
                key={s.id}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#2c2d32] border-b border-gray-700/30 last:border-b-0 ${
                  selected.has(s.id) ? 'bg-primary-500/10' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggleStudent(s.id)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-200">{s.name || s.users?.name || 'No name'}</p>
                  <p className="text-xs text-gray-500">{s.email || s.users?.email}</p>
                </div>
              </label>
            ))
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-gray-500">{selected.size} selected</span>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button>
            <Button onClick={handleSubmit} isLoading={isLoading} disabled={selected.size === 0}>
              Add Selected ({selected.size})
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default AdminSections;
