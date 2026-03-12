import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Calendar, FileText, Headphones, ClipboardList, ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock, Download } from 'lucide-react';
import { packagesApi } from '../../api';
import { StudentDailyPackage, QuizQuestion } from '../../types';
import { Spinner } from '../../components/ui/Loading';
import { Modal } from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

type TabType = 'daily' | 'weekly';

export function StudentPackages() {
  const { user } = useAuth();
  const isSchoolAffiliated = !!(user?.schoolId || user?.students?.schoolId || user?.studentProfile?.schoolId);

  const [activeTab, setActiveTab] = useState<TabType>('daily');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Daily
  const [dailyPackages, setDailyPackages] = useState<StudentDailyPackage[]>([]);
  const [isLoadingDaily, setIsLoadingDaily] = useState(true);

  // Weekly
  const [weeklyPackages, setWeeklyPackages] = useState<StudentDailyPackage[]>([]);
  const [weekRange, setWeekRange] = useState<{ start: string; end: string } | null>(null);
  const [isLoadingWeekly, setIsLoadingWeekly] = useState(false);

  // Quiz modal
  const [quizPackage, setQuizPackage] = useState<StudentDailyPackage | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);

  // Audio player
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  // Summary modal
  const [summaryPackage, setSummaryPackage] = useState<StudentDailyPackage | null>(null);

  useEffect(() => {
    if (isSchoolAffiliated) fetchDailyPackages();
  }, [selectedDate, isSchoolAffiliated]);

  // Only school-affiliated students can access packages
  if (!isSchoolAffiliated) {
    return <Navigate to="/dashboard/student" replace />;
  }

  const fetchDailyPackages = async () => {
    setIsLoadingDaily(true);
    try {
      const data = await packagesApi.getDailyPackages(selectedDate);
      setDailyPackages(data);
    } catch {
      toast.error('Failed to load daily packages');
    } finally {
      setIsLoadingDaily(false);
    }
  };

  const fetchWeeklyPackages = async (weekStart?: string) => {
    setIsLoadingWeekly(true);
    try {
      const data = await packagesApi.getWeeklyPackages(weekStart);
      setWeeklyPackages(data.packages);
      setWeekRange({ start: data.weekStart, end: data.weekEnd });
    } catch {
      toast.error('Failed to load weekly packages');
    } finally {
      setIsLoadingWeekly(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'weekly' && !weekRange) {
      fetchWeeklyPackages();
    }
  }, [activeTab]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    if (!weekRange) return;
    const date = new Date(weekRange.start);
    date.setDate(date.getDate() + (direction === 'next' ? 7 : -7));
    fetchWeeklyPackages(date.toISOString().split('T')[0]);
  };

  const navigateDay = (direction: 'prev' | 'next') => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const openQuiz = (pkg: StudentDailyPackage) => {
    setQuizPackage(pkg);
    setQuizAnswers({});
    setShowResults(false);
  };

  const submitQuiz = () => {
    setShowResults(true);
    if (!quizPackage?.quizJson) return;
    const correct = quizPackage.quizJson.filter((q, i) => quizAnswers[i] === q.correctAnswer).length;
    toast.success(`Score: ${correct}/${quizPackage.quizJson.length}`);
  };

  const handleDownloadPdf = async (pkg: StudentDailyPackage) => {
    try {
      const { url } = await packagesApi.getPackageDownload(pkg.id);
      window.open(url, '_blank');
    } catch {
      toast.error('Failed to get download link');
    }
  };

  const renderPackageCard = (pkg: StudentDailyPackage) => (
    <div key={pkg.id} className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{pkg.class_sections.name}</h3>
          <p className="text-xs text-gray-500">{pkg.subject.replace(/_/g, ' ')} {pkg.class_sections.grade && `· Grade ${pkg.class_sections.grade}`}</p>
          <p className="text-xs text-gray-400 mt-0.5">by {pkg.teachers.users.name || 'Teacher'}</p>
        </div>
        <span className="text-xs text-gray-400">{new Date(pkg.packageDate).toLocaleDateString()}</span>
      </div>

      {pkg.status !== 'COMPLETED' ? (
        <div className="flex items-center gap-2 py-4 text-gray-400">
          {pkg.status === 'PROCESSING' ? (
            <><Clock className="w-4 h-4 animate-pulse" /> <span className="text-sm">Processing...</span></>
          ) : pkg.status === 'FAILED' ? (
            <><XCircle className="w-4 h-4 text-red-400" /> <span className="text-sm text-red-400">Failed to process</span></>
          ) : (
            <><Clock className="w-4 h-4" /> <span className="text-sm">Pending</span></>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {pkg.pdfUrl && (
            <button
              onClick={() => handleDownloadPdf(pkg)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </button>
          )}
          {pkg.audioUrl && (
            <button
              onClick={() => setPlayingAudioId(playingAudioId === pkg.id ? null : pkg.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 rounded-lg hover:bg-violet-100 transition-colors"
            >
              <Headphones className="w-3.5 h-3.5" />
              {playingAudioId === pkg.id ? 'Hide Audio' : 'Listen'}
            </button>
          )}
          {pkg.quizJson && pkg.quizJson.length > 0 && (
            <button
              onClick={() => openQuiz(pkg)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Self-Assessment ({pkg.quizJson.length}Q)
            </button>
          )}
          {pkg.summaryText && (
            <button
              onClick={() => setSummaryPackage(pkg)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Summary
            </button>
          )}
        </div>
      )}

      {/* Inline audio player */}
      {playingAudioId === pkg.id && pkg.audioUrl && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <audio controls className="w-full h-8" src={pkg.audioUrl} />
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Learning Packages</h1>
        <p className="text-gray-600">Your daily question papers, study materials, and quizzes</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        <button
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'daily' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Calendar className="w-4 h-4 inline mr-1.5" />
          Daily
        </button>
        <button
          onClick={() => setActiveTab('weekly')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'weekly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <FileText className="w-4 h-4 inline mr-1.5" />
          Weekly
        </button>
      </div>

      {/* Daily Tab */}
      {activeTab === 'daily' && (
        <>
          {/* Date navigation */}
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigateDay('prev')} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input w-auto text-sm"
            />
            <button onClick={() => navigateDay('next')} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              Today
            </button>
          </div>

          {isLoadingDaily ? (
            <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
          ) : dailyPackages.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No packages for this date</p>
              <p className="text-sm mt-1">Check back later or try a different date</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {dailyPackages.map(renderPackageCard)}
            </div>
          )}
        </>
      )}

      {/* Weekly Tab */}
      {activeTab === 'weekly' && (
        <>
          {/* Week navigation */}
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigateWeek('prev')} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            {weekRange && (
              <span className="text-sm font-medium text-gray-700">
                {new Date(weekRange.start).toLocaleDateString()} – {new Date(weekRange.end).toLocaleDateString()}
              </span>
            )}
            <button onClick={() => navigateWeek('next')} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {isLoadingWeekly ? (
            <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
          ) : weeklyPackages.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No packages for this week</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {weeklyPackages.map(renderPackageCard)}
            </div>
          )}
        </>
      )}

      {/* Quiz Modal */}
      {quizPackage && quizPackage.quizJson && (
        <QuizModal
          isOpen={!!quizPackage}
          onClose={() => { setQuizPackage(null); setQuizAnswers({}); setShowResults(false); }}
          questions={quizPackage.quizJson}
          answers={quizAnswers}
          onAnswer={(qIndex, aIndex) => setQuizAnswers(prev => ({ ...prev, [qIndex]: aIndex }))}
          showResults={showResults}
          onSubmit={submitQuiz}
          sectionName={quizPackage.class_sections.name}
          subject={quizPackage.subject}
        />
      )}

      {/* Summary Modal */}
      {summaryPackage && (
        <Modal
          isOpen={!!summaryPackage}
          onClose={() => setSummaryPackage(null)}
          title={`Summary - ${summaryPackage.class_sections.name} (${summaryPackage.subject.replace(/_/g, ' ')})`}
        >
          <div className="prose prose-sm max-w-none">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{summaryPackage.summaryText}</p>
          </div>
          <div className="flex justify-end mt-4 pt-3 border-t">
            <Button variant="secondary" onClick={() => setSummaryPackage(null)}>Close</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Quiz Modal (self-assessment)
function QuizModal({
  isOpen, onClose, questions, answers, onAnswer, showResults, onSubmit, sectionName, subject,
}: {
  isOpen: boolean;
  onClose: () => void;
  questions: QuizQuestion[];
  answers: Record<number, number>;
  onAnswer: (qIndex: number, aIndex: number) => void;
  showResults: boolean;
  onSubmit: () => void;
  sectionName: string;
  subject: string;
}) {
  const correctCount = questions.filter((q, i) => answers[i] === q.correctAnswer).length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Self-Assessment - ${sectionName} (${subject.replace(/_/g, ' ')})`}>
      <div className="space-y-6 max-h-[60vh] overflow-y-auto">
        {showResults && (
          <div className={`p-4 rounded-lg text-center ${correctCount >= questions.length * 0.7 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
            <p className="text-lg font-semibold">{correctCount}/{questions.length} correct</p>
            <p className="text-sm">{correctCount >= questions.length * 0.7 ? 'Great job!' : 'Keep practicing!'}</p>
          </div>
        )}

        {questions.map((q, qIndex) => (
          <div key={q.id || qIndex} className="space-y-2">
            <p className="text-sm font-medium text-gray-900">
              {qIndex + 1}. {q.question}
            </p>
            <div className="space-y-1.5">
              {q.options.map((option, oIndex) => {
                const isSelected = answers[qIndex] === oIndex;
                const isCorrect = q.correctAnswer === oIndex;
                let optionClass = 'border-gray-200 hover:border-primary-300';
                if (showResults) {
                  if (isCorrect) optionClass = 'border-emerald-500 bg-emerald-50';
                  else if (isSelected && !isCorrect) optionClass = 'border-red-500 bg-red-50';
                } else if (isSelected) {
                  optionClass = 'border-primary-500 bg-primary-50';
                }

                return (
                  <button
                    key={oIndex}
                    onClick={() => !showResults && onAnswer(qIndex, oIndex)}
                    disabled={showResults}
                    className={`w-full text-left px-3 py-2 text-sm border rounded-lg transition-all ${optionClass}`}
                  >
                    <span className="font-medium mr-2">{String.fromCharCode(65 + oIndex)}.</span>
                    {option}
                    {showResults && isCorrect && <CheckCircle className="w-4 h-4 text-emerald-600 inline ml-2" />}
                    {showResults && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-600 inline ml-2" />}
                  </button>
                );
              })}
            </div>
            {showResults && q.explanation && (
              <p className="text-xs text-gray-500 italic mt-1">Explanation: {q.explanation}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
        <Button variant="secondary" onClick={onClose}>Close</Button>
        {!showResults && (
          <Button
            onClick={onSubmit}
            disabled={Object.keys(answers).length < questions.length}
          >
            Submit ({Object.keys(answers).length}/{questions.length})
          </Button>
        )}
      </div>
    </Modal>
  );
}

export default StudentPackages;
