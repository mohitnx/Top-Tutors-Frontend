import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Building2, Users, MapPin, UserPlus, ShieldCheck } from 'lucide-react';
import { schoolsApi, usersApi } from '../../api';
import { School, CreateSchoolData, UpdateSchoolData } from '../../api/schools';
import { Spinner } from '../../components/ui/Loading';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import toast from 'react-hot-toast';

export function AdminSchools() {
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAssignAdminOpen, setIsAssignAdminOpen] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSchools = async () => {
    setIsLoading(true);
    try {
      const data = await schoolsApi.getSchools();
      setSchools(data);
    } catch {
      toast.error('Failed to load schools');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchools();
  }, []);

  const handleCreate = async (data: CreateSchoolData & { adminName: string; adminEmail: string }) => {
    setIsSubmitting(true);
    try {
      // 1. Create school
      const schoolData: CreateSchoolData = { name: data.name, code: data.code };
      if (data.address) schoolData.address = data.address;
      if (data.city) schoolData.city = data.city;
      if (data.country) schoolData.country = data.country;
      const school = await schoolsApi.createSchool(schoolData);

      // 2. Create administrator for the school
      try {
        await usersApi.createUser({
          name: data.adminName,
          email: data.adminEmail,
          role: 'ADMINISTRATOR',
          schoolId: school.id,
        });
        toast.success('School and administrator created! Invitation sent.');
      } catch (adminError: unknown) {
        const err = adminError as { response?: { data?: { message?: string } } };
        toast.error(`School created but admin failed: ${err.response?.data?.message || 'Unknown error'}`);
      }

      setIsCreateOpen(false);
      fetchSchools();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to create school');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (data: UpdateSchoolData) => {
    if (!selectedSchool) return;
    setIsSubmitting(true);
    try {
      await schoolsApi.updateSchool(selectedSchool.id, data);
      toast.success('School updated');
      setIsEditOpen(false);
      setSelectedSchool(null);
      fetchSchools();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to update school');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignAdmin = async (data: { name: string; email: string }) => {
    if (!selectedSchool) return;
    setIsSubmitting(true);
    try {
      await usersApi.createUser({
        name: data.name,
        email: data.email,
        role: 'ADMINISTRATOR',
        schoolId: selectedSchool.id,
      });
      toast.success('Administrator created and invitation sent!');
      setIsAssignAdminOpen(false);
      setSelectedSchool(null);
      fetchSchools();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to assign administrator');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSchools = schools.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Schools</h1>
          <p className="text-gray-400">Create schools and assign administrators</p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setIsCreateOpen(true)}>
          Add School
        </Button>
      </div>

      {/* Search */}
      <div className="bg-[#25262b] border border-gray-700/50 rounded mb-6">
        <div className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        {/* Schools Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
        ) : filteredSchools.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p className="font-medium text-gray-300">No schools found</p>
            <p className="text-sm mt-1">Create your first school to get started</p>
          </div>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSchools.map((school) => (
              <div key={school.id} className="border border-gray-700/50 rounded-lg p-5 hover:border-primary-500/30 transition-colors bg-[#2c2d32]">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-200">{school.name}</h3>
                      <span className="text-xs text-gray-500 font-mono">{school.code}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => { setSelectedSchool(school); setIsEditOpen(true); }}
                    className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-[#35363b] rounded"
                    title="Edit school"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1.5 text-xs text-gray-500 mb-3">
                  {(school.address || school.city) && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3" />
                      <span>{[school.address, school.city, school.country].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3 h-3" />
                    <span>{school._count?.students ?? 0} students</span>
                  </div>
                </div>

                {/* Administrator status */}
                {school.administrator ? (
                  <div className="flex items-center gap-2 p-2.5 bg-emerald-500/10 rounded-lg">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-emerald-400 truncate">{school.administrator.name}</p>
                      <p className="text-[10px] text-emerald-500/70 truncate">{school.administrator.email}</p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setSelectedSchool(school); setIsAssignAdminOpen(true); }}
                    className="w-full flex items-center justify-center gap-2 p-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition-colors"
                  >
                    <UserPlus className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-medium text-amber-400">Assign Administrator</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create School Modal */}
      <CreateSchoolModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
        isLoading={isSubmitting}
      />

      {/* Edit School Modal */}
      {selectedSchool && (
        <EditSchoolModal
          isOpen={isEditOpen}
          onClose={() => { setIsEditOpen(false); setSelectedSchool(null); }}
          onSubmit={handleUpdate}
          school={selectedSchool}
          isLoading={isSubmitting}
        />
      )}

      {/* Assign Administrator Modal */}
      {selectedSchool && (
        <AssignAdminModal
          isOpen={isAssignAdminOpen}
          onClose={() => { setIsAssignAdminOpen(false); setSelectedSchool(null); }}
          onSubmit={handleAssignAdmin}
          schoolName={selectedSchool.name}
          isLoading={isSubmitting}
        />
      )}
    </div>
  );
}

// ─── Create School Modal (with mandatory Administrator) ───
function CreateSchoolModal({
  isOpen, onClose, onSubmit, isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateSchoolData & { adminName: string; adminEmail: string }) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    name: '', code: '', address: '', city: '', country: '',
    adminName: '', adminEmail: '',
  });

  useEffect(() => {
    if (isOpen) setFormData({ name: '', code: '', address: '', city: '', country: '', adminName: '', adminEmail: '' });
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: CreateSchoolData & { adminName: string; adminEmail: string } = {
      name: formData.name,
      code: formData.code.toUpperCase(),
      adminName: formData.adminName,
      adminEmail: formData.adminEmail,
    };
    if (formData.address) data.address = formData.address;
    if (formData.city) data.city = formData.city;
    if (formData.country) data.country = formData.country;
    onSubmit(data);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create School & Administrator">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* School Details */}
        <div className="bg-[#2c2d32] border border-gray-700/50 rounded-lg p-3">
          <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">School Details</p>
          <div className="space-y-3">
            <Input
              label="School Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="e.g. Springfield High School"
            />
            <Input
              label="School Code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              required
              placeholder="e.g. SPH-2024"
            />
            <p className="text-xs text-gray-500 -mt-2">Unique code. Uppercase letters, digits, and hyphens only.</p>
            <Input
              label="Address (optional)"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="e.g. 123 Main Street"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="City"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g. Springfield"
              />
              <Input
                label="Country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                placeholder="e.g. Nepal"
              />
            </div>
          </div>
        </div>

        {/* Administrator Details */}
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-3">
          <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-1">Administrator</p>
          <p className="text-xs text-violet-400/70 mb-3">An invitation email will be sent to set their password.</p>
          <div className="space-y-3">
            <Input
              label="Administrator Name"
              value={formData.adminName}
              onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
              required
              placeholder="e.g. Mohan Pant"
            />
            <Input
              label="Administrator Email"
              type="email"
              value={formData.adminEmail}
              onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
              required
              placeholder="e.g. admin@school.edu"
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button type="submit" isLoading={isLoading}>Create School & Admin</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit School Modal ───
function EditSchoolModal({
  isOpen, onClose, onSubmit, school, isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: UpdateSchoolData) => void;
  school: School;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    name: school.name,
    address: school.address || '',
    city: school.city || '',
    country: school.country || '',
  });

  useEffect(() => {
    setFormData({
      name: school.name,
      address: school.address || '',
      city: school.city || '',
      country: school.country || '',
    });
  }, [school]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: UpdateSchoolData = {};
    if (formData.name !== school.name) data.name = formData.name;
    if (formData.address !== (school.address || '')) data.address = formData.address;
    if (formData.city !== (school.city || '')) data.city = formData.city;
    if (formData.country !== (school.country || '')) data.country = formData.country;
    onSubmit(data);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit School">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="text-xs text-gray-400 bg-[#2c2d32] px-3 py-2 rounded">
          Code: <span className="font-mono font-medium">{school.code}</span>
        </div>
        <Input
          label="School Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
        <Input
          label="Address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="City"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
          />
          <Input
            label="Country"
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
          />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button type="submit" isLoading={isLoading}>Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Assign Administrator Modal ───
function AssignAdminModal({
  isOpen, onClose, onSubmit, schoolName, isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; email: string }) => void;
  schoolName: string;
  isLoading: boolean;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (isOpen) { setName(''); setEmail(''); }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, email });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign Administrator">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-3">
          <p className="text-xs text-violet-400">
            Create an administrator account for <strong>{schoolName}</strong>.
            An invitation email will be sent to set their password.
          </p>
        </div>
        <Input
          label="Administrator Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Mohan Pant"
        />
        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="e.g. admin@school.edu"
        />
        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button type="submit" isLoading={isLoading}>Create & Send Invite</Button>
        </div>
      </form>
    </Modal>
  );
}

export default AdminSchools;
