import { useState, useEffect, useRef } from 'react';
import { 
  User, Phone, MapPin, Calendar, Briefcase, BookOpen,
  Edit3, Save, X, Camera, Star, Clock, Users, MessageSquare,
  Award, GraduationCap, Globe, Linkedin, Link as LinkIcon, Plus,
  Trash2, CheckCircle, Shield, DollarSign, Loader2, Languages
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { tutorProfileApi, profileApi } from '../../api';
import { 
  TutorProfile as TutorProfileType, 
  Subject, 
  AcademicQualification,
  WorkExperience,
  Certificate,
  TeachingStyle 
} from '../../types';
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

const TEACHING_STYLES: TeachingStyle[] = ['Interactive', 'Lecture-based', 'Project-based', 'Discussion-based', 'Hands-on', 'Mixed'];
const TIMEZONES = ['Asia/Kathmandu', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo', 'Australia/Sydney'];
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

// Stats Card
function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-gray-800/40 rounded-lg p-2.5 border border-gray-700/50 text-center">
      <div className={`w-6 h-6 rounded ${color} flex items-center justify-center mx-auto mb-1`}>
        <Icon className="w-3 h-3 text-white" />
      </div>
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}

// Form Section
function FormSection({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/50">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

// Form Input
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

// Qualification Card
function QualificationCard({ qual, onRemove, isEditing }: { qual: AcademicQualification; onRemove?: () => void; isEditing: boolean }) {
  return (
    <div className="flex items-start gap-2 p-2.5 bg-gray-900/50 rounded-lg border border-gray-700/30">
      <div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center flex-shrink-0">
        <GraduationCap className="w-4 h-4 text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{qual.degree}</p>
        <p className="text-xs text-gray-400">{qual.field} - {qual.institution}</p>
        <p className="text-xs text-gray-500">{qual.year}{qual.gpa ? ` • GPA: ${qual.gpa}` : ''}</p>
      </div>
      {isEditing && onRemove && (
        <button onClick={onRemove} className="p-1 text-red-400 hover:text-red-300">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// Experience Card
function ExperienceCard({ exp, onRemove, isEditing }: { exp: WorkExperience; onRemove?: () => void; isEditing: boolean }) {
  return (
    <div className="flex items-start gap-2 p-2.5 bg-gray-900/50 rounded-lg border border-gray-700/30">
      <div className="w-8 h-8 rounded bg-purple-500/20 flex items-center justify-center flex-shrink-0">
        <Briefcase className="w-4 h-4 text-purple-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{exp.role}</p>
        <p className="text-xs text-gray-400">{exp.company}</p>
        <p className="text-xs text-gray-500">
          {exp.startDate && new Date(exp.startDate).getFullYear()} - {exp.endDate ? new Date(exp.endDate).getFullYear() : 'Present'}
        </p>
      </div>
      {isEditing && onRemove && (
        <button onClick={onRemove} className="p-1 text-red-400 hover:text-red-300">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// Certificate Card
function CertificateCard({ cert, onRemove, isEditing }: { cert: Certificate; onRemove?: () => void; isEditing: boolean }) {
  return (
    <div className="flex items-start gap-2 p-2.5 bg-gray-900/50 rounded-lg border border-gray-700/30">
      <div className="w-8 h-8 rounded bg-amber-500/20 flex items-center justify-center flex-shrink-0">
        <Award className="w-4 h-4 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-sm font-medium text-white">{cert.name}</p>
          {cert.verified && <CheckCircle className="w-3 h-3 text-emerald-400" />}
        </div>
        <p className="text-xs text-gray-400">{cert.issuedBy}</p>
      </div>
      {isEditing && onRemove && (
        <button onClick={onRemove} className="p-1 text-red-400 hover:text-red-300">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export function TutorProfilePage() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState<TutorProfileType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState<Partial<TutorProfileType>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Modal states
  const [showAddQual, setShowAddQual] = useState(false);
  const [showAddExp, setShowAddExp] = useState(false);
  const [showAddCert, setShowAddCert] = useState(false);
  const [newQual, setNewQual] = useState<Partial<AcademicQualification>>({});
  const [newExp, setNewExp] = useState<Partial<WorkExperience>>({});
  const [newCert, setNewCert] = useState<{ name: string; issuedBy: string; issuedDate?: string }>({ name: '', issuedBy: '' });

  // Fetch profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await tutorProfileApi.getMyProfile();
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
      const updateData = {
        bio: editForm.bio,
        phoneNumber: editForm.phoneNumber,
        dateOfBirth: editForm.dateOfBirth,
        address: editForm.address,
        city: editForm.city,
        state: editForm.state,
        country: editForm.country,
        timezone: editForm.timezone,
        qualification: editForm.qualification,
        academicQualifications: editForm.academicQualifications,
        experience: editForm.experience,
        hourlyRate: editForm.hourlyRate,
        subjects: editForm.subjects,
        areasOfExpertise: editForm.areasOfExpertise,
        teachingPhilosophy: editForm.teachingPhilosophy,
        teachingStyle: editForm.teachingStyle,
        workExperience: editForm.workExperience,
        researchExperience: editForm.researchExperience,
        publications: editForm.publications,
        linkedinUrl: editForm.linkedinUrl,
        websiteUrl: editForm.websiteUrl,
        languages: editForm.languages,
        isAvailable: editForm.isAvailable,
        availabilitySchedule: editForm.availabilitySchedule,
      };

      const response = await tutorProfileApi.updateMyProfile(updateData);
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
    const current = editForm.subjects || [];
    const updated = current.includes(subject) ? current.filter(s => s !== subject) : [...current, subject];
    setEditForm({ ...editForm, subjects: updated });
  };

  const addQualification = () => {
    if (!newQual.institution || !newQual.degree || !newQual.field) {
      toast.error('Please fill required fields');
      return;
    }
    const quals = [...(editForm.academicQualifications || []), newQual as AcademicQualification];
    setEditForm({ ...editForm, academicQualifications: quals });
    setNewQual({});
    setShowAddQual(false);
  };

  const removeQualification = (index: number) => {
    const quals = editForm.academicQualifications?.filter((_, i) => i !== index);
    setEditForm({ ...editForm, academicQualifications: quals });
  };

  const addExperience = () => {
    if (!newExp.company || !newExp.role) {
      toast.error('Please fill required fields');
      return;
    }
    const exps = [...(editForm.workExperience || []), newExp as WorkExperience];
    setEditForm({ ...editForm, workExperience: exps });
    setNewExp({});
    setShowAddExp(false);
  };

  const removeExperience = (index: number) => {
    const exps = editForm.workExperience?.filter((_, i) => i !== index);
    setEditForm({ ...editForm, workExperience: exps });
  };

  const addCertificate = async () => {
    if (!newCert.name || !newCert.issuedBy) {
      toast.error('Please fill required fields');
      return;
    }
    try {
      const response = await tutorProfileApi.addCertificate(newCert);
      setProfile(response.data.data);
      setNewCert({ name: '', issuedBy: '' });
      setShowAddCert(false);
      toast.success('Certificate added!');
    } catch (error) {
      console.error('Failed to add certificate:', error);
      toast.error('Failed to add certificate');
    }
  };

  const removeCertificate = async (certId: string) => {
    try {
      const response = await tutorProfileApi.removeCertificate(certId);
      setProfile(response.data.data);
      toast.success('Certificate removed');
    } catch (error) {
      console.error('Failed to remove certificate:', error);
      toast.error('Failed to remove certificate');
    }
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

  return (
    <div className="min-h-screen bg-[#212121] text-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
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
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            {profile.isVerified && (
              <div className="absolute -bottom-1 -right-1 p-0.5 bg-blue-500 rounded-full">
                <Shield className="w-3 h-3 text-white" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold truncate">{profile.name || user?.name}</h1>
              <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">Tutor</span>
              {profile.isAvailable && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  Available
                </span>
              )}
            </div>
            {profile.rating && (
              <div className="flex items-center gap-1 mb-1">
                <div className="flex">{[1,2,3,4,5].map(s => <Star key={s} className={`w-3 h-3 ${s <= Math.round(profile.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`} />)}</div>
                <span className="text-sm font-medium">{profile.rating.toFixed(1)}</span>
                <span className="text-xs text-gray-400">({profile.totalReviews})</span>
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              {profile.subjects?.slice(0, 3).map(s => {
                const info = SUBJECTS.find(sub => sub.value === s);
                return <span key={s} className={`px-1.5 py-0.5 text-xs rounded ${info?.color || 'bg-gray-600'} text-white`}>{info?.label || s}</span>;
              })}
              {(profile.subjects?.length || 0) > 3 && <span className="px-1.5 py-0.5 text-xs bg-gray-700 rounded">+{(profile.subjects?.length || 0) - 3}</span>}
            </div>
          </div>

          {/* Edit Button */}
          {!isEditing ? (
            <button onClick={handleStartEdit} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg border border-gray-700 text-sm">
              <Edit3 className="w-3.5 h-3.5" /> Edit
            </button>
          ) : (
            <div className="flex gap-1.5">
              <button onClick={handleCancelEdit} className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 text-sm">
                <X className="w-3.5 h-3.5" />
              </button>
              <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg text-sm disabled:opacity-50">
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mb-4">
          <StatCard icon={Users} label="Students" value={profile.totalStudentsTaught || 0} color="bg-blue-500" />
          <StatCard icon={MessageSquare} label="Sessions" value={profile.totalSessionsCompleted || 0} color="bg-purple-500" />
          <StatCard icon={Clock} label="Hours" value={Math.round(profile.totalHoursTaught || 0)} color="bg-emerald-500" />
          <StatCard icon={Star} label="Rating" value={profile.rating?.toFixed(1) || '-'} color="bg-amber-500" />
          <StatCard icon={Award} label="Reviews" value={profile.totalReviews || 0} color="bg-pink-500" />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-4">
            {/* Bio */}
            <FormSection title="About">
              {isEditing ? (
                <textarea
                  value={editForm.bio || ''}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  placeholder="Tell students about yourself..."
                  className="w-full p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 resize-none h-20"
                />
              ) : (
                <p className="text-sm text-gray-300">{profile.bio || 'No bio added'}</p>
              )}
            </FormSection>

            {/* Education */}
            <FormSection 
              title="Education" 
              action={isEditing && (
                <button onClick={() => setShowAddQual(true)} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add
                </button>
              )}
            >
              <div className="space-y-2">
                {(isEditing ? editForm.academicQualifications : profile.academicQualifications)?.map((q, i) => (
                  <QualificationCard key={i} qual={q} isEditing={isEditing} onRemove={() => removeQualification(i)} />
                ))}
                {!(isEditing ? editForm.academicQualifications : profile.academicQualifications)?.length && (
                  <p className="text-xs text-gray-500">No qualifications added</p>
                )}
              </div>
            </FormSection>

            {/* Experience */}
            <FormSection 
              title="Experience" 
              action={isEditing && (
                <button onClick={() => setShowAddExp(true)} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add
                </button>
              )}
            >
              <div className="space-y-2">
                {(isEditing ? editForm.workExperience : profile.workExperience)?.map((e, i) => (
                  <ExperienceCard key={i} exp={e} isEditing={isEditing} onRemove={() => removeExperience(i)} />
                ))}
                {!(isEditing ? editForm.workExperience : profile.workExperience)?.length && (
                  <p className="text-xs text-gray-500">No experience added</p>
                )}
              </div>
            </FormSection>

            {/* Certificates */}
            <FormSection 
              title="Certificates" 
              action={
                <button onClick={() => setShowAddCert(true)} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add
                </button>
              }
            >
              <div className="space-y-2">
                {profile.certificates?.map((c) => (
                  <CertificateCard key={c.id} cert={c} isEditing={true} onRemove={() => c.id && removeCertificate(c.id)} />
                ))}
                {!profile.certificates?.length && <p className="text-xs text-gray-500">No certificates added</p>}
              </div>
            </FormSection>

            {/* Teaching Philosophy (Edit Mode) */}
            {isEditing && (
              <FormSection title="Teaching">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Philosophy</label>
                    <textarea
                      value={editForm.teachingPhilosophy || ''}
                      onChange={(e) => setEditForm({ ...editForm, teachingPhilosophy: e.target.value })}
                      className="w-full p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 resize-none h-16"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Style</label>
                    <select
                      value={editForm.teachingStyle || ''}
                      onChange={(e) => setEditForm({ ...editForm, teachingStyle: e.target.value as TeachingStyle })}
                      className="w-full p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500/50"
                    >
                      <option value="">Select style</option>
                      {TEACHING_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </FormSection>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Subjects */}
            <FormSection title="Subjects">
              {isEditing ? (
                <div className="flex flex-wrap gap-1.5">
                  {SUBJECTS.map((subject) => {
                    const isSelected = editForm.subjects?.includes(subject.value);
                    return (
                      <button
                        key={subject.value}
                        type="button"
                        onClick={() => handleSubjectToggle(subject.value)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-all ${isSelected ? `${subject.color} text-white` : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'}`}
                      >
                        {subject.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {profile.subjects?.map(s => {
                    const info = SUBJECTS.find(sub => sub.value === s);
                    return <span key={s} className={`px-2 py-1 rounded text-xs ${info?.color || 'bg-gray-600'} text-white`}>{info?.label || s}</span>;
                  })}
                </div>
              )}
            </FormSection>

            {/* Rate */}
            <FormSection title="Hourly Rate">
              {isEditing ? (
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">$</span>
                  <input
                    type="number"
                    value={editForm.hourlyRate || ''}
                    onChange={(e) => setEditForm({ ...editForm, hourlyRate: parseFloat(e.target.value) || 0 })}
                    className="w-20 p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-lg font-bold text-white focus:outline-none focus:border-amber-500/50"
                  />
                  <span className="text-gray-400 text-sm">/hr</span>
                </div>
              ) : (
                <p className="text-xl font-bold">${profile.hourlyRate || 0}<span className="text-sm font-normal text-gray-400">/hr</span></p>
              )}
            </FormSection>

            {/* Languages */}
            <FormSection title="Languages">
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.languages?.join(', ') || ''}
                  onChange={(e) => setEditForm({ ...editForm, languages: e.target.value.split(',').map(l => l.trim()).filter(Boolean) })}
                  placeholder="English, Spanish"
                  className="w-full p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                />
              ) : (
                <div className="flex flex-wrap gap-1">
                  {profile.languages?.map((l, i) => (
                    <span key={i} className="px-2 py-0.5 bg-gray-700/50 text-gray-300 rounded text-xs">{l}</span>
                  ))}
                </div>
              )}
            </FormSection>

            {/* Links */}
            <FormSection title="Links">
              {isEditing ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Linkedin className="w-4 h-4 text-gray-500" />
                    <input
                      type="url"
                      value={editForm.linkedinUrl || ''}
                      onChange={(e) => setEditForm({ ...editForm, linkedinUrl: e.target.value })}
                      placeholder="LinkedIn URL"
                      className="flex-1 p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-gray-500" />
                    <input
                      type="url"
                      value={editForm.websiteUrl || ''}
                      onChange={(e) => setEditForm({ ...editForm, websiteUrl: e.target.value })}
                      placeholder="Website URL"
                      className="flex-1 p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {profile.linkedinUrl && (
                    <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300">
                      <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                    </a>
                  )}
                  {profile.websiteUrl && (
                    <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300">
                      <LinkIcon className="w-3.5 h-3.5" /> Website
                    </a>
                  )}
                  {!profile.linkedinUrl && !profile.websiteUrl && <p className="text-xs text-gray-500">No links added</p>}
                </div>
              )}
            </FormSection>

            {/* Availability Toggle */}
            {isEditing && (
              <FormSection title="Availability">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.isAvailable ?? profile.isAvailable}
                    onChange={(e) => setEditForm({ ...editForm, isAvailable: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-sm text-gray-300">Available for new sessions</span>
                </label>
              </FormSection>
            )}
          </div>
        </div>
      </div>

      {/* Add Qualification Modal */}
      {showAddQual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-800 rounded-xl p-4 w-full max-w-md mx-4 border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Add Qualification</h3>
            <div className="space-y-3">
              <FormInput label="Institution *" value={newQual.institution || ''} onChange={(e) => setNewQual({ ...newQual, institution: e.target.value })} />
              <FormInput label="Degree *" value={newQual.degree || ''} onChange={(e) => setNewQual({ ...newQual, degree: e.target.value })} />
              <FormInput label="Field *" value={newQual.field || ''} onChange={(e) => setNewQual({ ...newQual, field: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <FormInput label="Year" type="number" value={newQual.year || ''} onChange={(e) => setNewQual({ ...newQual, year: parseInt(e.target.value) || undefined })} />
                <FormInput label="GPA" value={newQual.gpa || ''} onChange={(e) => setNewQual({ ...newQual, gpa: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setShowAddQual(false); setNewQual({}); }} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">Cancel</button>
              <button onClick={addQualification} className="px-3 py-1.5 bg-amber-500 text-black rounded-lg text-sm font-medium">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Experience Modal */}
      {showAddExp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-800 rounded-xl p-4 w-full max-w-md mx-4 border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Add Experience</h3>
            <div className="space-y-3">
              <FormInput label="Company *" value={newExp.company || ''} onChange={(e) => setNewExp({ ...newExp, company: e.target.value })} />
              <FormInput label="Role *" value={newExp.role || ''} onChange={(e) => setNewExp({ ...newExp, role: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <FormInput label="Start Date" type="date" value={newExp.startDate || ''} onChange={(e) => setNewExp({ ...newExp, startDate: e.target.value })} />
                <FormInput label="End Date" type="date" value={newExp.endDate || ''} onChange={(e) => setNewExp({ ...newExp, endDate: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Description</label>
                <textarea
                  value={newExp.description || ''}
                  onChange={(e) => setNewExp({ ...newExp, description: e.target.value })}
                  className="w-full p-2 bg-gray-900/50 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 resize-none h-16"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setShowAddExp(false); setNewExp({}); }} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">Cancel</button>
              <button onClick={addExperience} className="px-3 py-1.5 bg-amber-500 text-black rounded-lg text-sm font-medium">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Certificate Modal */}
      {showAddCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-800 rounded-xl p-4 w-full max-w-md mx-4 border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Add Certificate</h3>
            <div className="space-y-3">
              <FormInput label="Certificate Name *" value={newCert.name} onChange={(e) => setNewCert({ ...newCert, name: e.target.value })} />
              <FormInput label="Issued By *" value={newCert.issuedBy} onChange={(e) => setNewCert({ ...newCert, issuedBy: e.target.value })} />
              <FormInput label="Issue Date" type="date" value={newCert.issuedDate || ''} onChange={(e) => setNewCert({ ...newCert, issuedDate: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setShowAddCert(false); setNewCert({ name: '', issuedBy: '' }); }} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">Cancel</button>
              <button onClick={addCertificate} className="px-3 py-1.5 bg-amber-500 text-black rounded-lg text-sm font-medium">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TutorProfilePage;
