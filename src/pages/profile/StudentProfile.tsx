import { useState, useEffect, useRef } from 'react';
import { 
  User, Phone, MapPin, School, Calendar, Target, BookOpen,
  Edit3, Save, X, Camera, Flame, Trophy, Clock, TrendingUp,
  CheckCircle, Loader2, Sparkles, GraduationCap, Users, Mail
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { studentProfileApi, profileApi } from '../../api';
import { StudentProfile as StudentProfileType, Subject } from '../../types';
import Avatar from '../../components/ui/Avatar';
import toast from 'react-hot-toast';

const SUBJECTS: { value: Subject; label: string; color: string }[] = [
  { value: Subject.MATHEMATICS, label: 'Math', color: 'bg-teal-500' },
  { value: Subject.PHYSICS, label: 'Physics', color: 'bg-purple-500' },
  { value: Subject.CHEMISTRY, label: 'Chemistry', color: 'bg-red-500' },
  { value: Subject.BIOLOGY, label: 'Biology', color: 'bg-green-500' },
  { value: Subject.ENGLISH, label: 'English', color: 'bg-orange-500' },
  { value: Subject.HISTORY, label: 'History', color: 'bg-amber-600' },
  { value: Subject.GEOGRAPHY, label: 'Geography', color: 'bg-yellow-500' },
  { value: Subject.COMPUTER_SCIENCE, label: 'CS', color: 'bg-blue-500' },
  { value: Subject.ECONOMICS, label: 'Economics', color: 'bg-slate-500' },
  { value: Subject.ACCOUNTING, label: 'Accounting', color: 'bg-gray-500' },
];

const ACADEMIC_LEVELS = ['Elementary', 'Middle School', 'High School', 'Undergraduate', 'Graduate', 'Professional'];
const TIMEZONES = ['Asia/Kathmandu', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo', 'Australia/Sydney'];

// Stats Card Component
function StatCard({ icon: Icon, label, value, subtext, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subtext?: string;
  color: string;
}) {
  return (
    <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/50">
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      {subtext && <p className="text-xs text-gray-500">{subtext}</p>}
    </div>
  );
}

// Achievement Badge Component
function AchievementBadge({ name, description, unlocked, icon }: {
  name: string;
  description: string;
  unlocked: boolean;
  icon: string;
}) {
  return (
    <div className={`relative p-2.5 rounded-lg border transition-all ${
      unlocked 
        ? 'bg-amber-500/10 border-amber-500/30' 
        : 'bg-gray-800/30 border-gray-700/50 opacity-50'
    }`}>
      <div className="text-xl mb-1">{icon}</div>
      <p className={`text-xs font-medium ${unlocked ? 'text-amber-200' : 'text-gray-400'}`}>{name}</p>
      <p className="text-xs text-gray-500">{description}</p>
      {unlocked && (
        <div className="absolute top-1.5 right-1.5">
          <CheckCircle className="w-3 h-3 text-amber-400" />
        </div>
      )}
    </div>
  );
}

// Form Section Component
function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
      <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
      {children}
    </div>
  );
}

// Form Input Component
function FormInput({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <input
        {...props}
        className="w-full p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
      />
    </div>
  );
}

export function StudentProfilePage() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState<StudentProfileType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState<Partial<StudentProfileType>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await studentProfileApi.getMyProfile();
        setProfile(response.data.data);
      } catch (error) {
        console.error('Failed to fetch profile:', error);
        toast.error('Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleStartEdit = () => {
    setEditForm({ ...profile });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditForm({});
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Only send editable fields
      const updateData = {
        grade: editForm.grade,
        school: editForm.school,
        phoneNumber: editForm.phoneNumber,
        dateOfBirth: editForm.dateOfBirth,
        parentName: editForm.parentName,
        parentEmail: editForm.parentEmail,
        parentPhone: editForm.parentPhone,
        address: editForm.address,
        city: editForm.city,
        state: editForm.state,
        country: editForm.country,
        timezone: editForm.timezone,
        preferredSubjects: editForm.preferredSubjects,
        learningGoals: editForm.learningGoals,
        academicLevel: editForm.academicLevel,
      };

      const response = await studentProfileApi.updateMyProfile(updateData);
      setProfile(response.data.data);
      setIsEditing(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    try {
      const response = await profileApi.uploadAvatar(file);
      setProfile(prev => prev ? { ...prev, avatar: response.data.data.avatar } : null);
      refreshUser?.();
      toast.success('Avatar updated!');
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      toast.error('Failed to upload avatar');
    }
  };

  const handleSubjectToggle = (subject: Subject) => {
    const current = editForm.preferredSubjects || [];
    const updated = current.includes(subject)
      ? current.filter(s => s !== subject)
      : [...current, subject];
    setEditForm({ ...editForm, preferredSubjects: updated });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#212121] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#212121] flex items-center justify-center text-gray-400">
        Failed to load profile
      </div>
    );
  }

  const achievements = [
    { name: 'First Steps', description: 'Asked first question', unlocked: true, icon: '🚀' },
    { name: 'Week Warrior', description: '7-day streak', unlocked: (profile.currentStreak || 0) >= 7, icon: '🔥' },
    { name: 'Deep Diver', description: '10+ hours learned', unlocked: (profile.totalHoursLearned || 0) >= 10, icon: '🏊' },
    { name: 'Curious Mind', description: '25 questions', unlocked: (profile.totalQuestions || 0) >= 25, icon: '🧠' },
  ];

  return (
    <div className="min-h-screen bg-[#212121] text-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          {/* Avatar */}
          <div className="relative group">
            <div className="w-16 h-16 rounded-xl overflow-hidden ring-2 ring-gray-700">
              {profile.avatar ? (
                <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                <Avatar name={profile.name || user?.name || ''} size="lg" className="w-full h-full text-xl" />
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
            >
              <Camera className="w-4 h-4 text-white" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            {(profile.currentStreak || 0) > 0 && (
              <div className="absolute -bottom-1 -right-1 flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-500 rounded-full text-xs font-bold">
                <Flame className="w-2.5 h-2.5" />
                {profile.currentStreak}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold truncate">{profile.name || user?.name}</h1>
              <span className="px-1.5 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30">
                Student
              </span>
            </div>
            <p className="text-gray-400 text-sm truncate">{profile.email || user?.email}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {profile.school && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-800/50 rounded text-xs text-gray-300">
                  <School className="w-3 h-3" /> {profile.school}
                </span>
              )}
              {profile.grade && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-800/50 rounded text-xs text-gray-300">
                  <GraduationCap className="w-3 h-3" /> {profile.grade}
                </span>
              )}
            </div>
          </div>

          {/* Edit Button */}
          {!isEditing ? (
            <button
              onClick={handleStartEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg border border-gray-700 text-sm"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit
            </button>
          ) : (
            <div className="flex gap-1.5">
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 text-sm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg text-sm disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
          <StatCard icon={Flame} label="Streak" value={profile.currentStreak || 0} subtext={`Best: ${profile.longestStreak || 0}`} color="bg-orange-500" />
          <StatCard icon={Target} label="Questions" value={profile.totalQuestions || 0} color="bg-blue-500" />
          <StatCard icon={Clock} label="Hours" value={(profile.totalHoursLearned || 0).toFixed(1)} color="bg-emerald-500" />
          <StatCard icon={TrendingUp} label="Sessions" value={profile.totalSessions || 0} color="bg-purple-500" />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-4">
            {/* Achievements */}
            <FormSection title="Achievements">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {achievements.map((a, i) => (
                  <AchievementBadge key={i} {...a} />
                ))}
              </div>
            </FormSection>

            {/* Learning Goals */}
            <FormSection title="Learning Goals">
              {isEditing ? (
                <textarea
                  value={editForm.learningGoals || ''}
                  onChange={(e) => setEditForm({ ...editForm, learningGoals: e.target.value })}
                  placeholder="What are your learning goals?"
                  className="w-full p-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 resize-none h-20"
                />
              ) : (
                <p className="text-sm text-gray-300">{profile.learningGoals || 'No learning goals set'}</p>
              )}
            </FormSection>

            {/* Personal Info (Edit Mode) */}
            {isEditing && (
              <FormSection title="Personal Information">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormInput
                    label="Phone Number"
                    type="tel"
                    value={editForm.phoneNumber || ''}
                    onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                    placeholder="+1234567890"
                  />
                  <FormInput
                    label="Date of Birth"
                    type="date"
                    value={editForm.dateOfBirth?.split('T')[0] || ''}
                    onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                  />
                  <FormInput
                    label="Grade"
                    type="text"
                    value={editForm.grade || ''}
                    onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}
                    placeholder="Grade 11"
                  />
                  <FormInput
                    label="School"
                    type="text"
                    value={editForm.school || ''}
                    onChange={(e) => setEditForm({ ...editForm, school: e.target.value })}
                    placeholder="Springfield High School"
                  />
                  <FormInput
                    label="Address"
                    type="text"
                    value={editForm.address || ''}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    placeholder="123 Main St"
                  />
                  <FormInput
                    label="City"
                    type="text"
                    value={editForm.city || ''}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    placeholder="New York"
                  />
                  <FormInput
                    label="State"
                    type="text"
                    value={editForm.state || ''}
                    onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                    placeholder="NY"
                  />
                  <FormInput
                    label="Country"
                    type="text"
                    value={editForm.country || ''}
                    onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                    placeholder="USA"
                  />
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Timezone</label>
                    <select
                      value={editForm.timezone || ''}
                      onChange={(e) => setEditForm({ ...editForm, timezone: e.target.value })}
                      className="w-full p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500/50"
                    >
                      <option value="">Select timezone</option>
                      {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Academic Level</label>
                    <select
                      value={editForm.academicLevel || ''}
                      onChange={(e) => setEditForm({ ...editForm, academicLevel: e.target.value })}
                      className="w-full p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500/50"
                    >
                      <option value="">Select level</option>
                      {ACADEMIC_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>
              </FormSection>
            )}

            {/* Parent Info (Edit Mode) */}
            {isEditing && (
              <FormSection title="Parent/Guardian Information">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <FormInput
                    label="Parent Name"
                    type="text"
                    value={editForm.parentName || ''}
                    onChange={(e) => setEditForm({ ...editForm, parentName: e.target.value })}
                    placeholder="John Doe"
                  />
                  <FormInput
                    label="Parent Email"
                    type="email"
                    value={editForm.parentEmail || ''}
                    onChange={(e) => setEditForm({ ...editForm, parentEmail: e.target.value })}
                    placeholder="parent@email.com"
                  />
                  <FormInput
                    label="Parent Phone"
                    type="tel"
                    value={editForm.parentPhone || ''}
                    onChange={(e) => setEditForm({ ...editForm, parentPhone: e.target.value })}
                    placeholder="+1234567890"
                  />
                </div>
              </FormSection>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Preferred Subjects */}
            <FormSection title="Preferred Subjects">
              {isEditing ? (
                <div className="flex flex-wrap gap-1.5">
                  {SUBJECTS.map((subject) => {
                    const isSelected = editForm.preferredSubjects?.includes(subject.value);
                    return (
                      <button
                        key={subject.value}
                        type="button"
                        onClick={() => handleSubjectToggle(subject.value)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                          isSelected
                            ? `${subject.color} text-white`
                            : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        {subject.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {profile.preferredSubjects?.length ? (
                    profile.preferredSubjects.map((subject) => {
                      const info = SUBJECTS.find(s => s.value === subject);
                      return (
                        <span key={subject} className={`px-2 py-1 rounded text-xs font-medium ${info?.color || 'bg-gray-600'} text-white`}>
                          {info?.label || subject}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-xs text-gray-500">No subjects selected</span>
                  )}
                </div>
              )}
            </FormSection>

            {/* Profile Info (View Mode) */}
            {!isEditing && (
              <>
                <FormSection title="Academic">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-300">
                      <GraduationCap className="w-3.5 h-3.5 text-gray-500" />
                      <span>{profile.academicLevel || 'Not set'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <Calendar className="w-3.5 h-3.5 text-gray-500" />
                      <span>{profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString() : 'Not set'}</span>
                    </div>
                  </div>
                </FormSection>

                <FormSection title="Contact">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-300">
                      <Phone className="w-3.5 h-3.5 text-gray-500" />
                      <span>{profile.phoneNumber || 'Not set'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <MapPin className="w-3.5 h-3.5 text-gray-500" />
                      <span>{profile.city && profile.country ? `${profile.city}, ${profile.country}` : 'Not set'}</span>
                    </div>
                  </div>
                </FormSection>

                {profile.parentName && (
                  <FormSection title="Parent/Guardian">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-300">
                        <Users className="w-3.5 h-3.5 text-gray-500" />
                        <span>{profile.parentName}</span>
                      </div>
                      {profile.parentEmail && (
                        <div className="flex items-center gap-2 text-gray-300">
                          <Mail className="w-3.5 h-3.5 text-gray-500" />
                          <span>{profile.parentEmail}</span>
                        </div>
                      )}
                    </div>
                  </FormSection>
                )}
              </>
            )}

            {/* Profile Completion */}
            <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-amber-100">Profile</span>
              </div>
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-1">
                <div 
                  className="h-full bg-amber-500 transition-all"
                  style={{ width: profile.profileCompleted ? '100%' : '60%' }}
                />
              </div>
              <p className="text-xs text-gray-400">
                {profile.profileCompleted ? 'Complete!' : 'Complete to unlock features'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StudentProfilePage;
