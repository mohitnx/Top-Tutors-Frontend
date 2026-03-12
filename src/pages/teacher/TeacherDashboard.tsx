import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Image, Loader2, CheckCircle, XCircle, Clock, FileText, Calendar, Users, ChevronLeft, Layers, Eye, Award, Star, Hash } from 'lucide-react';
import { teachersApi, dailyPackageApi } from '../../api';
import { TeacherSection, DailyPackageUpload, DailyPackageStatus, DailyPackageUploadDetail, ExtractedQuestion } from '../../types';
import { Spinner } from '../../components/ui/Loading';
import Button from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import toast from 'react-hot-toast';

type View = 'main' | 'upload' | 'processing' | 'detail';

export function TeacherDashboard() {
  const [assignments, setAssignments] = useState<TeacherSection[]>([]);
  const [isLoadingSections, setIsLoadingSections] = useState(true);

  // Current view
  const [view, setView] = useState<View>('main');

  // Upload view
  const [uploadTarget, setUploadTarget] = useState<TeacherSection | null>(null);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Processing view (polling)
  const [processingStatus, setProcessingStatus] = useState<DailyPackageStatus>('PENDING');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Detail view
  const [uploadDetail, setUploadDetail] = useState<DailyPackageUploadDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Recent uploads
  const [uploads, setUploads] = useState<DailyPackageUpload[]>([]);
  const [isLoadingUploads, setIsLoadingUploads] = useState(true);

  useEffect(() => {
    fetchSections();
    fetchUploads();
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const fetchSections = async () => {
    setIsLoadingSections(true);
    try {
      const data = await teachersApi.getMySections();
      setAssignments(data);
    } catch {
      toast.error('Failed to load sections');
    } finally {
      setIsLoadingSections(false);
    }
  };

  const fetchUploads = async () => {
    setIsLoadingUploads(true);
    try {
      const response = await dailyPackageApi.getMyUploads(1, 20);
      setUploads(Array.isArray(response) ? response : response.data ?? []);
    } catch {
      toast.error('Failed to load uploads');
    } finally {
      setIsLoadingUploads(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (selectedImages.length + files.length > 50) {
      toast.error('Maximum 50 images allowed per upload');
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const invalidFiles = files.filter(f => !validTypes.includes(f.type));
    if (invalidFiles.length > 0) {
      toast.error('Only JPEG, PNG, and WebP images are allowed');
      return;
    }

    setSelectedImages(prev => [...prev, ...files]);

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!uploadTarget) return;
    if (selectedImages.length === 0) {
      toast.error('Please select at least one image');
      return;
    }

    setIsUploading(true);
    try {
      const result = await dailyPackageApi.uploadQuestions(
        uploadTarget.sectionId,
        uploadTarget.subject,
        selectedImages,
      );
      toast.success('Upload started! Processing will begin shortly.');
      setSelectedImages([]);
      setImagePreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Switch to processing view and start polling
      setProcessingStatus('PENDING');
      setView('processing');
      startPolling(result.uploadId);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to upload questions');
    } finally {
      setIsUploading(false);
    }
  };

  const startPolling = useCallback((uploadId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const detail = await dailyPackageApi.getUploadDetail(uploadId);
        setProcessingStatus(detail.status);

        if (detail.status === 'COMPLETED' || detail.status === 'FAILED') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;

          if (detail.status === 'COMPLETED') {
            toast.success('Processing complete!');
            setUploadDetail(detail);
            setView('detail');
          } else {
            toast.error(detail.errorMsg || 'Processing failed');
          }
          fetchUploads();
        }
      } catch {
        // Silently retry on network errors
      }
    }, 5000);
  }, []);

  const openUploadDetail = async (uploadId: string) => {
    setIsLoadingDetail(true);
    setView('detail');
    try {
      const detail = await dailyPackageApi.getUploadDetail(uploadId);
      setUploadDetail(detail);
    } catch {
      toast.error('Failed to load upload details');
      setView('main');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const goBack = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setView('main');
    setUploadTarget(null);
    setSelectedImages([]);
    setImagePreviews([]);
    setUploadDetail(null);
  };

  const getStatusBadge = (status: DailyPackageStatus) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="inline-flex items-center gap-1 badge bg-emerald-100 text-emerald-800"><CheckCircle className="w-3 h-3" /> Completed</span>;
      case 'PROCESSING':
        return <span className="inline-flex items-center gap-1 badge bg-blue-100 text-blue-800"><Loader2 className="w-3 h-3 animate-spin" /> Processing</span>;
      case 'FAILED':
        return <span className="inline-flex items-center gap-1 badge bg-red-100 text-red-800"><XCircle className="w-3 h-3" /> Failed</span>;
      default:
        return <span className="inline-flex items-center gap-1 badge bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3" /> Pending</span>;
    }
  };

  // --- Processing View (polling) ---
  if (view === 'processing') {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={goBack} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Processing Upload</h1>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <div className="mb-6">
            {processingStatus === 'FAILED' ? (
              <XCircle className="w-16 h-16 text-red-400 mx-auto" />
            ) : (
              <Loader2 className="w-16 h-16 text-primary-500 mx-auto animate-spin" />
            )}
          </div>

          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {processingStatus === 'PENDING' && 'Queued for processing...'}
            {processingStatus === 'PROCESSING' && 'Processing your questions...'}
            {processingStatus === 'FAILED' && 'Processing failed'}
          </h2>

          <p className="text-sm text-gray-500 mb-6">
            {processingStatus === 'FAILED'
              ? 'There was an error processing your upload. Please try again.'
              : 'This may take a few minutes. We\'re extracting questions, ranking them, generating answers, and creating study materials.'}
          </p>

          <div className="flex items-center justify-center gap-4">
            {processingStatus !== 'FAILED' && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                Processing steps: OCR → Ranking → Answers → PDF → Audio
              </div>
            )}
          </div>

          <div className="mt-6">
            <Button variant="secondary" onClick={goBack}>
              {processingStatus === 'FAILED' ? 'Go Back' : 'Continue in Background'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Detail View (extracted questions) ---
  if (view === 'detail') {
    if (isLoadingDetail || !uploadDetail) {
      return (
        <div className="p-6 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={goBack} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Upload Details</h1>
          </div>
          <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
        </div>
      );
    }

    const sectionName = uploadDetail.class_sections?.name || 'Section';
    const sectionGrade = uploadDetail.class_sections?.grade;
    const mostAsked = uploadDetail.extracted_questions.filter(q => q.rankType === 'MOST_ASKED').sort((a, b) => (a.rankPosition || 0) - (b.rankPosition || 0));
    const bestAsked = uploadDetail.extracted_questions.filter(q => q.rankType === 'BEST_ASKED').sort((a, b) => (a.rankPosition || 0) - (b.rankPosition || 0));
    const otherQuestions = uploadDetail.extracted_questions.filter(q => !q.rankType);

    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={goBack} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Upload Details</h1>
            <p className="text-gray-500 text-sm">
              {sectionName} {sectionGrade && `· Grade ${sectionGrade}`} · {uploadDetail.subject.replace(/_/g, ' ')}
            </p>
          </div>
          <div className="ml-auto">{getStatusBadge(uploadDetail.status)}</div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{uploadDetail._count?.upload_images || uploadDetail.upload_images.length}</p>
            <p className="text-xs text-gray-500">Images Uploaded</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{uploadDetail._count?.extracted_questions || uploadDetail.extracted_questions.length}</p>
            <p className="text-xs text-gray-500">Questions Extracted</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-primary-600">{mostAsked.length}</p>
            <p className="text-xs text-gray-500">Most Asked</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{bestAsked.length}</p>
            <p className="text-xs text-gray-500">Best Asked</p>
          </div>
        </div>

        {/* Generated packages */}
        {uploadDetail.daily_packages && uploadDetail.daily_packages.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg mb-6">
            <div className="px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Generated Packages</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {uploadDetail.daily_packages.map(pkg => (
                <div key={pkg.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(pkg.packageDate).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      {pkg.pdfUrl && <span className="text-xs text-primary-600">PDF Ready</span>}
                      {pkg.audioUrl && <span className="text-xs text-violet-600">Audio Ready</span>}
                      {pkg.quizJson && <span className="text-xs text-amber-600">Quiz Ready</span>}
                      {pkg.summaryText && <span className="text-xs text-emerald-600">Summary</span>}
                    </div>
                  </div>
                  {getStatusBadge(pkg.status)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Most Asked Questions */}
        {mostAsked.length > 0 && (
          <QuestionList
            title="Most Asked Questions"
            icon={<Award className="w-5 h-5 text-primary-600" />}
            questions={mostAsked}
            badgeColor="bg-primary-100 text-primary-700"
          />
        )}

        {/* Best Asked Questions */}
        {bestAsked.length > 0 && (
          <QuestionList
            title="Best Asked Questions"
            icon={<Star className="w-5 h-5 text-amber-500" />}
            questions={bestAsked}
            badgeColor="bg-amber-100 text-amber-700"
          />
        )}

        {/* Other Extracted Questions */}
        {otherQuestions.length > 0 && (
          <QuestionList
            title="Other Extracted Questions"
            icon={<Hash className="w-5 h-5 text-gray-500" />}
            questions={otherQuestions}
            badgeColor="bg-gray-100 text-gray-600"
          />
        )}

        {/* Uploaded Images */}
        {uploadDetail.upload_images.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg mb-6">
            <div className="px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Uploaded Images ({uploadDetail.upload_images.length})</h2>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 p-4">
              {uploadDetail.upload_images.sort((a, b) => a.sortOrder - b.sortOrder).map((img) => (
                <ImageThumbnail key={img.id} src={img.imageUrl} label={`${img.sortOrder + 1}`} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          <Button variant="secondary" onClick={goBack}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  // --- Upload View ---
  if (view === 'upload' && uploadTarget) {
    const sectionName = uploadTarget.class_sections?.name || 'Section';
    const sectionGrade = uploadTarget.class_sections?.grade;
    const subjectLabel = uploadTarget.subject.replace(/_/g, ' ');

    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={goBack} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Upload Questions</h1>
            <p className="text-gray-500 text-sm">
              {sectionName} {sectionGrade && `· Grade ${sectionGrade}`} · {subjectLabel}
            </p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          {/* Image upload area */}
          <div className="mb-4">
            <label className="label">Question Images</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-500 hover:bg-primary-50/50 transition-all"
            >
              <Image className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Click to upload question images</p>
              <p className="text-xs text-gray-400 mt-1">JPEG, PNG, or WebP (max 50 images)</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />
          </div>

          {/* Image previews */}
          {imagePreviews.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-4">
              {imagePreviews.map((preview, index) => (
                <div key={index} className="relative group">
                  <img src={preview} alt={`Question ${index + 1}`} className="w-full h-24 object-cover rounded-lg border" />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <XCircle className="w-3 h-3" />
                  </button>
                  <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded">
                    {index + 1}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={goBack}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={isUploading || selectedImages.length === 0}
              isLoading={isUploading}
              leftIcon={<Upload className="w-4 h-4" />}
            >
              Upload & Process {selectedImages.length > 0 ? `(${selectedImages.length})` : ''}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Main View ---
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h1>
        <p className="text-gray-600">Upload daily question papers for your assigned sections</p>
      </div>

      {/* My Sections */}
      <div className="bg-white border border-gray-200 rounded-lg mb-8">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary-600" />
            My Sections
          </h2>
        </div>

        {isLoadingSections ? (
          <div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Layers className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No sections assigned yet</p>
            <p className="text-sm mt-1 max-w-sm mx-auto">
              You can add content once an administrator creates a section and assigns you to it.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {assignments.map((assignment) => {
              const section = assignment.class_sections;
              const studentCount = section?._count?.student_sections ?? 0;

              return (
                <div
                  key={`${assignment.sectionId}-${assignment.subject}`}
                  className="flex items-center justify-between p-5 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {section?.name || 'Unknown Section'}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          {assignment.subject.replace(/_/g, ' ')}
                        </span>
                        {section?.grade && (
                          <span className="text-xs text-gray-500">Grade {section.grade}</span>
                        )}
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Users className="w-3 h-3" /> {studentCount} student{studentCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    leftIcon={<Upload className="w-3.5 h-3.5" />}
                    onClick={() => { setUploadTarget(assignment); setView('upload'); }}
                  >
                    Upload Content
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Uploads */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-600" />
            Recent Uploads
          </h2>
        </div>

        {isLoadingUploads ? (
          <div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>
        ) : uploads.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="font-medium">No uploads yet</p>
            <p className="text-sm mt-1">Upload your first question paper from a section above</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {uploads.map((upload) => (
              <div key={upload.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {upload.class_sections?.name || 'Unknown Section'} - {upload.subject.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(upload.createdAt).toLocaleDateString()} · {upload._count?.upload_images ?? 0} image{(upload._count?.upload_images ?? 0) !== 1 ? 's' : ''} · {upload._count?.extracted_questions ?? 0} questions
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(upload.status)}
                  {upload.status === 'COMPLETED' && (
                    <button
                      onClick={() => openUploadDetail(upload.id)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  {upload.status === 'FAILED' && upload.errorMsg && (
                    <span className="text-xs text-red-500" title={upload.errorMsg}>Error</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Sub-components ---

function QuestionList({ title, icon, questions, badgeColor }: {
  title: string;
  icon: React.ReactNode;
  questions: ExtractedQuestion[];
  badgeColor: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg mb-6">
      <div className="px-5 py-4 border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          {icon}
          {title} ({questions.length})
        </h2>
      </div>
      <div className="divide-y divide-gray-100">
        {questions.map((q, idx) => (
          <div key={q.id} className="p-4">
            <div className="flex items-start gap-3">
              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${badgeColor} shrink-0 mt-0.5`}>
                {q.rankPosition ?? idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">{q.questionText}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  {q.frequency > 1 && (
                    <span className="text-xs text-gray-500">Appeared {q.frequency}x</span>
                  )}
                </div>
                {q.shortAnswer && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 border-l-2 border-primary-300">
                    <span className="font-medium">Answer: </span>{q.shortAnswer}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImageThumbnail({ src, label }: { src: string; label: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <div
        className="relative group cursor-pointer"
        onClick={() => setIsOpen(true)}
      >
        <img src={src} alt={`Image ${label}`} className="w-full h-20 object-cover rounded-lg border" />
        <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded">
          {label}
        </span>
      </div>
      {isOpen && (
        <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={`Image ${label}`}>
          <img src={src} alt={`Image ${label}`} className="w-full rounded-lg" />
        </Modal>
      )}
    </>
  );
}

export default TeacherDashboard;
