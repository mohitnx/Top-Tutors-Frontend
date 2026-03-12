import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Building2, GraduationCap, Layers, Plus, UserPlus, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usersApi, schoolsApi, sectionsApi, teachersApi } from '../../api';
import { User, Role, ClassSection, Teacher } from '../../types';
import { School } from '../../api/schools';
import { Spinner } from '../../components/ui/Loading';
import Button from '../../components/ui/Button';

export function AdminDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === Role.ADMIN;

  const [isLoading, setIsLoading] = useState(true);

  // ADMIN stats
  const [schools, setSchools] = useState<School[]>([]);
  const [tutors, setTutors] = useState<User[]>([]);
  const [adminStats, setAdminStats] = useState({
    totalSchools: 0,
    totalTutors: 0,
    totalUsers: 0,
  });

  // ADMINISTRATOR stats
  const [adminrStats, setAdminrStats] = useState({
    schoolName: '',
    totalStudents: 0,
    totalTeachers: 0,
    totalSections: 0,
  });
  const [sections, setSections] = useState<ClassSection[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  useEffect(() => {
    if (isAdmin) {
      fetchAdminData();
    } else {
      fetchAdministratorData();
    }
  }, [isAdmin]);

  const fetchAdminData = async () => {
    try {
      const [schoolsData, usersResponse] = await Promise.all([
        schoolsApi.getSchools(),
        usersApi.getUsers(1, 100),
      ]);

      setSchools(schoolsData);

      const allUsers = Array.isArray(usersResponse) ? usersResponse : usersResponse.data || [];
      const tutorUsers = allUsers.filter((u: User) => u.role === 'TUTOR');
      setTutors(tutorUsers);

      const usersTotal = Array.isArray(usersResponse) ? usersResponse.length : usersResponse.total || 0;

      setAdminStats({
        totalSchools: schoolsData.length,
        totalTutors: tutorUsers.length,
        totalUsers: usersTotal,
      });
    } catch (error) {
      console.error('Failed to fetch admin dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAdministratorData = async () => {
    try {
      const [sectionsData, teachersData] = await Promise.all([
        sectionsApi.getSections(),
        teachersApi.getTeachers(),
      ]);

      setSections(sectionsData);
      setTeachers(teachersData);

      const schoolId = user?.administeredSchool?.id;
      let schoolData: School | null = null;
      if (schoolId) {
        try {
          schoolData = await schoolsApi.getSchool(schoolId);
        } catch {
          // May fail if API not available
        }
      }

      const totalStudents = schoolData?._count?.students ?? sectionsData.reduce((sum, s) => sum + (s._count?.student_sections ?? 0), 0);

      setAdminrStats({
        schoolName: schoolData?.name || user?.administeredSchool?.name || 'My School',
        totalStudents,
        totalTeachers: teachersData.length,
        totalSections: sectionsData.length,
      });
    } catch (error) {
      console.error('Failed to fetch administrator dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  // --- ADMINISTRATOR Dashboard ---
  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-100 mb-1">School Dashboard</h1>
          <p className="text-gray-400">
            Welcome back, {user?.name?.split(' ')[0] || 'Admin'}. Managing <strong className="text-gray-200">{adminrStats.schoolName}</strong>.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard
            icon={<Users className="w-5 h-5" />}
            label="Students"
            value={adminrStats.totalStudents}
            color="primary"
            link="/admin/users"
          />
          <StatCard
            icon={<GraduationCap className="w-5 h-5" />}
            label="Teachers"
            value={adminrStats.totalTeachers}
            color="amber"
            link="/admin/teachers"
          />
          <StatCard
            icon={<Layers className="w-5 h-5" />}
            label="Subjects"
            value={adminrStats.totalSections}
            color="violet"
            link="/admin/sections"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Sections Overview */}
          <div className="bg-[#25262b] border border-gray-700/50 rounded">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50">
              <h2 className="font-bold text-gray-100">Subjects</h2>
              <Link to="/admin/sections" className="text-sm text-primary-400 hover:text-primary-300 font-medium">
                View all
              </Link>
            </div>
            {sections.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No subjects assigned yet
              </div>
            ) : (
              <div className="divide-y divide-gray-700/50">
                {sections.slice(0, 5).map((section) => (
                  <Link
                    key={section.id}
                    to="/admin/sections"
                    className="block px-6 py-3 hover:bg-[#2c2d32] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-200">{section.name}</p>
                        <p className="text-xs text-gray-500">
                          {section.grade && `Grade ${section.grade} · `}
                          {section._count?.teacher_sections ?? 0} subjects · {section._count?.student_sections ?? 0} students
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Teachers Overview */}
          <div className="bg-[#25262b] border border-gray-700/50 rounded">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50">
              <h2 className="font-bold text-gray-100">Teachers</h2>
              <Link to="/admin/teachers" className="text-sm text-primary-400 hover:text-primary-300 font-medium">
                View all
              </Link>
            </div>
            {teachers.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No teachers in your school yet
              </div>
            ) : (
              <div className="divide-y divide-gray-700/50">
                {teachers.slice(0, 5).map((teacher) => (
                  <div key={teacher.id} className="px-6 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-200">{teacher.users.name || 'No name'}</p>
                      <p className="text-xs text-gray-500">{teacher.users.email}</p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {teacher.teacher_sections?.length || 0} sections
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =============================================
  // ADMIN Dashboard — Schools + Tutors focused
  // =============================================
  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 mb-1">Platform Admin</h1>
          <p className="text-gray-400">
            Manage schools, assign administrators, and add tutors.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/schools">
            <Button variant="secondary" leftIcon={<Plus className="w-4 h-4" />}>
              Add School
            </Button>
          </Link>
          <Link to="/admin/users">
            <Button leftIcon={<UserPlus className="w-4 h-4" />}>
              Add User
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={<Building2 className="w-5 h-5" />}
          label="Schools"
          value={adminStats.totalSchools}
          color="violet"
          link="/admin/schools"
        />
        <StatCard
          icon={<ShieldCheck className="w-5 h-5" />}
          label="Tutors"
          value={adminStats.totalTutors}
          color="primary"
          link="/admin/users"
        />
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Total Users"
          value={adminStats.totalUsers}
          color="emerald"
          link="/admin/users"
        />
      </div>

      {/* Schools — the main content for ADMIN */}
      <div className="bg-[#25262b] border border-gray-700/50 rounded mb-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50">
          <h2 className="font-bold text-gray-100">Schools & Administrators</h2>
          <Link to="/admin/schools" className="text-sm text-primary-400 hover:text-primary-300 font-medium">
            Manage schools
          </Link>
        </div>

        {schools.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p className="font-medium text-gray-200">No schools yet</p>
            <p className="text-sm text-gray-500 mt-1 mb-4">Create your first school and assign an administrator</p>
            <Link to="/admin/schools">
              <Button size="sm" leftIcon={<Plus className="w-4 h-4" />}>Create School</Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-700/50">
            {schools.map((school) => (
              <Link
                key={school.id}
                to="/admin/schools"
                className="block px-6 py-4 hover:bg-[#2c2d32] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-200">{school.name}</p>
                      <p className="text-xs text-gray-500">
                        <span className="font-mono">{school.code}</span>
                        {school.city && ` · ${school.city}`}
                        {school.country && `, ${school.country}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div className="text-xs text-gray-500">
                      {school._count?.students ?? 0} students
                    </div>
                    {school.administrator ? (
                      <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full">
                        <ShieldCheck className="w-3 h-3" />
                        {school.administrator.name}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full">
                        No administrator
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Tutors section */}
      <div className="bg-[#25262b] border border-gray-700/50 rounded">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50">
          <h2 className="font-bold text-gray-100">Tutors (Freelance)</h2>
          <Link to="/admin/users" className="text-sm text-primary-400 hover:text-primary-300 font-medium">
            View all users
          </Link>
        </div>

        {tutors.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="font-medium">No tutors yet</p>
            <p className="text-sm mt-1">Create tutor accounts from the Users page</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700/50">
            {tutors.slice(0, 5).map((t) => (
              <div key={t.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-200">{t.name || 'No name'}</p>
                  <p className="text-xs text-gray-500">{t.email}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${t.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'}`}>
                  {t.isActive ? 'Active' : 'Pending'}
                </span>
              </div>
            ))}
            {tutors.length > 5 && (
              <div className="px-6 py-3 text-center">
                <Link to="/admin/users" className="text-sm text-primary-400 hover:text-primary-300 font-medium">
                  View all {tutors.length} tutors
                </Link>
              </div>
            )}
          </div>
        )}
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
    primary: 'bg-primary-500/10 text-primary-400',
    violet: 'bg-violet-500/10 text-violet-400',
    amber: 'bg-amber-500/10 text-amber-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
  };

  const content = (
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-100">{value}</p>
        <p className="text-sm text-gray-400">{label}</p>
      </div>
    </div>
  );

  if (link) {
    return (
      <Link
        to={link}
        className="bg-[#25262b] border border-gray-700/50 rounded p-4 hover:border-primary-500/30 hover:bg-[#2c2d32] transition-all"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="bg-[#25262b] border border-gray-700/50 rounded p-4">
      {content}
    </div>
  );
}

export default AdminDashboard;
