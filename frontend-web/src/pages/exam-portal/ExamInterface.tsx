import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useSecureExam, type SecurityViolationEvent } from '../../hooks/useSecureExam';
import { apiClient } from '../../lib/apiClient';

type QuestionStatus = 'NOT_VISITED' | 'NOT_ANSWERED' | 'ANSWERED' | 'MARKED_FOR_REVIEW' | 'ANSWERED_AND_MARKED_FOR_REVIEW';

interface Question {
  id: string;
  type: string;
  text: string;
  marks: number;
  options?: any;
  image?: string;
}

export default function ExamInterface() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const passedQuiz = (location.state as { quiz?: any } | null)?.quiz || null;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [responses, setResponses] = useState<Record<string, { data: any; status: QuestionStatus }>>({});
  const [timeLeft, setTimeLeft] = useState((passedQuiz?.durationMinutes || 60) * 60);
  const [saving, setSaving] = useState(false);
  const [attemptId, setAttemptId] = useState<string>('');
  const [quizDetails, setQuizDetails] = useState<any>(passedQuiz);
  const [loadingInstructions, setLoadingInstructions] = useState(true);
  const [instructionsError, setInstructionsError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [startingExam, setStartingExam] = useState(false);
  const [hasStartedSecureExam, setHasStartedSecureExam] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const [lockedOutMessage, setLockedOutMessage] = useState<string | null>(null);
  const [showMobilePalette, setShowMobilePalette] = useState(false);
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
  const [imageStatus, setImageStatus] = useState<'loading' | 'loaded' | 'error'>('loaded');
  const submittingRef = useRef(false);
  const attemptIdRef = useRef('');

  // Zero-tolerance: any monitored violation immediately hides quiz (black screen), persists violation, and quits/submits exam
  const handleSecurityViolation = useCallback(async (event: SecurityViolationEvent) => {
    const activeAttemptId = attemptIdRef.current || attemptId;
    if (!activeAttemptId || submittingRef.current) return;
    submittingRef.current = true;
    try {
      const res = await apiClient.fetch(`/api/v1/student/exam/attempt/${activeAttemptId}/violation`, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: event.type,
          reason: event.reason,
          timestamp: event.timestamp,
          metadata: event.metadata,
        }),
      });
      if (!res?.ok) {
        await apiClient.fetch(`/api/v1/student/exam/attempt/${activeAttemptId}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ violationReason: `${event.type}: ${event.reason}` }),
        }).catch(() => {});
      }
    } catch (e) {
      console.error('Failed to record violation:', e);
      await apiClient.fetch(`/api/v1/student/exam/attempt/${activeAttemptId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ violationReason: `${event.type}: ${event.reason}` }),
      }).catch(() => {});
    } finally {
      if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen().catch(() => {});
      }
      toast.error(`Security violation detected (${event.type}). Your exam has been submitted.`);
      navigate('/student/dashboard?tab=quizzes', { replace: true });
    }
  }, [attemptId, navigate]);

  const { isFullscreen, isBlackScreen, enterFullscreen } = useSecureExam({
    isActive: hasStartedSecureExam,
    onViolation: handleSecurityViolation
  });

  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  useEffect(() => {
    const activeQ = questions[currentQuestionIdx];
    setImageStatus(activeQ?.image ? 'loading' : 'loaded');
    setZoomedImageUrl(null);
  }, [currentQuestionIdx, questions]);

  const loadInstructions = useCallback(async () => {
    if (!quizId) {
      setInstructionsError({ message: 'Invalid quiz identifier.', retryable: false });
      setLoadingInstructions(false);
      return;
    }
    setLoadingInstructions(true);
    setInstructionsError(null);
    try {
      const res = await apiClient.fetch(`/api/v1/student/exam/instructions/${quizId}`);
      const data = await res.json();
      if (res?.ok !== false && data?.status === 'success' && data?.data?.quiz) {
        setQuizDetails(data.data.quiz);
        if (data.data.quiz.durationMinutes) {
          setTimeLeft(data.data.quiz.durationMinutes * 60);
        }
      } else {
        const msg = data?.error?.message || data?.message || 'Unable to load quiz instructions.';
        const code = data?.error?.code;
        if (code === 'ATTEMPT_LOCKED') {
          setLockedOutMessage(msg);
          return;
        }
        const nonRetryable = ['NOT_FOUND', 'FORBIDDEN', 'ALREADY_SUBMITTED', 'NOT_STARTED', 'EXPIRED', 'ATTEMPT_LOCKED'].includes(code);
        setInstructionsError({ message: msg, retryable: !nonRetryable });
      }
    } catch (err) {
      console.error(err);
      setInstructionsError({ message: 'Unable to load quiz instructions. Please try again.', retryable: true });
    } finally {
      setLoadingInstructions(false);
    }
  }, [quizId]);

  useEffect(() => {
    void loadInstructions();
  }, [loadInstructions]);

  const handleSaveResponse = async (questionId: string, answerData: any, status: QuestionStatus) => {
    setResponses(prev => ({ ...prev, [questionId]: { data: answerData, status } }));
    setSaving(true);
    try {
      await apiClient.fetch(`/api/v1/student/exam/attempt/${attemptId}/save-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, answerData, status })
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    const qId = questions[currentQuestionIdx].id;
    const currentResp = responses[qId];

    if (!currentResp || currentResp.status === 'NOT_VISITED') {
      handleSaveResponse(qId, null, 'NOT_ANSWERED');
    }

    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
      const nextQId = questions[currentQuestionIdx + 1].id;
      if (!responses[nextQId]) {
        handleSaveResponse(nextQId, null, 'NOT_ANSWERED');
      }
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIdx > 0) {
      setCurrentQuestionIdx(prev => prev - 1);
    }
  };

  const handleMarkReview = () => {
    const qId = questions[currentQuestionIdx].id;
    const currentResp = responses[qId];
    const isAnswered = currentResp?.data !== null && currentResp?.data !== undefined && currentResp?.data !== '';
    const status = isAnswered ? 'ANSWERED_AND_MARKED_FOR_REVIEW' : 'MARKED_FOR_REVIEW';
    handleSaveResponse(qId, currentResp?.data, status);
    handleNext();
  };

  const handleClear = () => {
    const qId = questions[currentQuestionIdx].id;
    handleSaveResponse(qId, null, 'NOT_ANSWERED');
  };

  const handleSubmit = useCallback(async () => {
    const currentAttemptId = attemptIdRef.current || attemptId;
    if (!currentAttemptId || submittingRef.current) return;

    submittingRef.current = true;
    try {
      const res = await apiClient.fetch(`/api/v1/student/exam/attempt/${currentAttemptId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (res?.ok !== false && data?.status === 'success') {
        toast.success('Examination Submitted Successfully!');
        navigate('/student/dashboard?tab=quizzes', { replace: true });
      } else {
        toast.error('Error submitting: ' + (data?.message || 'Request failed'));
        navigate('/student/dashboard?tab=quizzes', { replace: true });
      }
    } catch (e) {
      console.error(e);
      toast.error('Error submitting examination');
      navigate('/student/dashboard?tab=quizzes', { replace: true });
    } finally {
      submittingRef.current = false;
    }
  }, [attemptId, navigate]);

  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;

  useEffect(() => {
    if (!hasStartedSecureExam || !attemptId) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          void handleSubmitRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [hasStartedSecureExam, attemptId]);

  const handleBeginQuiz = async () => {
    if (!quizId || startingExam || instructionsError) return;
    setStartingExam(true);
    setFullscreenError(null);
    try {
      const fsResult = await enterFullscreen();
      if (!fsResult?.ok) {
        setFullscreenError(
          fsResult?.error || 'Fullscreen mode is required to start this quiz. Please allow fullscreen and try again.'
        );
        return;
      }

      const res = await apiClient.fetch(`/api/v1/student/exam/start/${quizId}`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res?.ok !== false && data?.status === 'success' && data?.data?.attempt && data?.data?.quiz) {
        const { attempt, quiz } = data.data;
        setQuizDetails((prev: any) => ({ ...prev, ...quiz }));
        setQuestions(quiz.questions || []);
        setAttemptId(attempt.id);
        attemptIdRef.current = attempt.id;

        const loadedResponses: Record<string, { data: any; status: QuestionStatus }> = {};
        if (attempt.responses) {
          attempt.responses.forEach((r: any) => {
            loadedResponses[r.questionId] = { data: r.answerData, status: r.status };
          });
        }
        setResponses(loadedResponses);

        const startTime = new Date(attempt.startTime).getTime();
        const durationSec = (quiz.durationMinutes || 60) * 60;
        const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
        setTimeLeft(Math.max(0, durationSec - elapsedSec));
        setHasStartedSecureExam(true);
      } else {
        if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen().catch(() => {});
        }
        const msg = data?.error?.message || data?.message || 'Unable to start this quiz.';
        const code = data?.error?.code;
        if (code === 'ATTEMPT_LOCKED') {
          setLockedOutMessage(msg);
          return;
        }
        toast.error(msg);
        setInstructionsError({ message: msg, retryable: false });
      }
    } catch (err) {
      console.error(err);
      if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen().catch(() => {});
      }
      toast.error('Unable to start quiz. Please try again.');
    } finally {
      setStartingExam(false);
    }
  };

  if (lockedOutMessage) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] text-ink flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-2xl p-8 text-center shadow-sm space-y-5">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-red-50 border border-red-200 text-xs font-bold text-red-700 uppercase tracking-wide">
            Locked
          </div>
          <h1 className="text-2xl font-serif font-bold text-ink">Quiz Attempt Locked</h1>
          <p className="text-sm text-gray-body leading-relaxed">
            You have violated the quiz rules. Your quiz attempt has been locked. Please contact your faculty member if you require permission to restart.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate('/student/dashboard?tab=quizzes', { replace: true })}
              className="px-6 py-2.5 bg-maroon hover:bg-maroon-deep text-white rounded-full text-sm font-bold cursor-pointer"
            >
              Back to Quizzes
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!hasStartedSecureExam) {
    if (loadingInstructions && !quizDetails) {
      return (
        <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center gap-3 text-gray-body font-sans">
          <div className="animate-spin h-8 w-8 border-4 border-maroon border-t-transparent rounded-full" />
          <p className="text-sm font-semibold">Loading quiz instructions...</p>
        </div>
      );
    }

    if (instructionsError) {
      return (
        <div className="min-h-screen bg-[#FDFBF7] text-ink flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-white border border-border-soft rounded-2xl p-8 text-center shadow-sm space-y-5">
            <h1 className="text-2xl font-serif font-bold text-ink">Quiz Unavailable</h1>
            <p className="text-sm text-gray-body">{instructionsError.message}</p>
            <div className="flex items-center justify-center gap-3">
              {instructionsError.retryable && (
                <button
                  type="button"
                  onClick={() => void loadInstructions()}
                  className="px-5 py-2.5 border border-maroon text-maroon hover:bg-maroon/5 rounded-full text-sm font-bold cursor-pointer"
                >
                  Retry
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('/student/dashboard?tab=quizzes')}
                className="px-6 py-2.5 bg-maroon hover:bg-maroon-deep text-white rounded-full text-sm font-bold cursor-pointer"
              >
                Back to Quizzes
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#FDFBF7] text-ink flex flex-col items-center justify-center p-6 sm:p-8 font-sans">
        <div className="max-w-2xl w-full space-y-6">
          <div>
            <button
              type="button"
              onClick={() => navigate('/student/dashboard?tab=quizzes')}
              className="inline-flex items-center gap-2 text-sm font-semibold text-gray-body hover:text-maroon transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Back to Quizzes
            </button>
          </div>

          <div className="text-center space-y-2">
            {quizDetails?.subject && (
              <span className="inline-block px-3 py-1 rounded-full bg-cream border border-border-soft text-xs font-bold text-maroon">
                {quizDetails.subject}
              </span>
            )}
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-ink">
              {quizDetails?.title || 'Quiz Instructions'}
            </h1>
            <p className="text-gray-body text-base">
              Please review the quiz details and instructions carefully before starting.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-border-soft rounded-xl p-4 text-center shadow-sm">
              <div className="text-xs font-semibold text-gray-body uppercase tracking-wide">Duration</div>
              <div className="text-lg font-bold text-maroon mt-1">{quizDetails?.durationMinutes ?? '--'} mins</div>
            </div>
            <div className="bg-white border border-border-soft rounded-xl p-4 text-center shadow-sm">
              <div className="text-xs font-semibold text-gray-body uppercase tracking-wide">Total Marks</div>
              <div className="text-lg font-bold text-ink mt-1">{quizDetails?.totalMarks ?? '--'}</div>
            </div>
            <div className="bg-white border border-border-soft rounded-xl p-4 text-center shadow-sm">
              <div className="text-xs font-semibold text-gray-body uppercase tracking-wide">Questions</div>
              <div className="text-lg font-bold text-ink mt-1">{quizDetails?.questionCount ?? quizDetails?._count?.questions ?? '--'}</div>
            </div>
            <div className="bg-white border border-border-soft rounded-xl p-4 text-center shadow-sm">
              <div className="text-xs font-semibold text-gray-body uppercase tracking-wide">Passing Marks</div>
              <div className="text-lg font-bold text-ink mt-1">{quizDetails?.passingMarks ?? 'N/A'}</div>
            </div>
          </div>

          {quizDetails?.description && (
            <div className="bg-white border border-border-soft rounded-xl p-5 shadow-sm text-sm text-gray-body leading-relaxed">
              <div className="text-xs font-bold uppercase tracking-wide text-ink mb-1">About This Quiz</div>
              <p>{quizDetails.description}</p>
            </div>
          )}

          <div className="bg-white border border-maroon/30 shadow-sm p-6 sm:p-8 rounded-2xl text-left space-y-5">
            <div className="flex items-center space-x-3 text-maroon">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              <h2 className="font-bold text-xl font-serif">Important Instructions</h2>
            </div>

            <ul className="space-y-3.5 text-ink font-semibold text-sm sm:text-base">
              <li className="flex items-start">
                <span className="text-maroon mr-3">•</span>
                This exam requires <span className="font-bold ml-1">Fullscreen mode</span>.
              </li>
              <li className="flex items-start">
                <span className="text-maroon mr-3">•</span>
                Do not exit fullscreen, switch tabs, or leave the exam window.
              </li>
              <li className="flex items-start">
                <span className="text-maroon mr-3">•</span>
                Right-clicking, copying, and pasting are disabled.
              </li>
              <li className="flex items-start">
                <span className="text-maroon mr-3">•</span>
                The countdown timer begins as soon as you click Begin Quiz.
              </li>
              <li className="flex items-start">
                <span className="text-maroon mr-3">•</span>
                Any security violation will automatically submit your examination.
              </li>
            </ul>
          </div>

          <div className="flex flex-col items-center justify-center gap-3 pt-2">
            {fullscreenError && (
              <div
                role="alert"
                className="w-full bg-red-50 border border-red-200 text-red-900 rounded-xl p-4 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <span className="font-medium">{fullscreenError}</span>
                <button
                  type="button"
                  onClick={handleBeginQuiz}
                  disabled={startingExam}
                  className="px-4 py-2 bg-maroon hover:bg-maroon-deep text-white font-bold rounded-full text-xs shrink-0 cursor-pointer"
                >
                  Retry Fullscreen
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={handleBeginQuiz}
              disabled={startingExam || loadingInstructions}
              className="px-10 py-4 bg-maroon hover:bg-maroon-deep disabled:opacity-50 text-white font-bold rounded-full text-lg shadow-sm transition-all hover:scale-105 active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>{startingExam ? 'Starting Quiz...' : 'Begin Quiz'}</span>
              {!startingExam && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-maroon border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isBlackScreen || !isFullscreen) {
    const canPromptFullscreen =
      !isFullscreen && (typeof document === 'undefined' || document.visibilityState !== 'hidden');
    return (
      <div
        data-testid="security-black-screen"
        style={{ backgroundColor: '#000000' }}
        className="fixed inset-0 z-[9999] bg-[#000000] select-none flex items-center justify-center"
      >
        {canPromptFullscreen && (
          <button
            type="button"
            onClick={async () => {
              await enterFullscreen();
            }}
            className="px-8 py-3 bg-white text-black font-bold rounded-full text-sm cursor-pointer"
          >
            Enter Fullscreen
          </button>
        )}
      </div>
    );
  }

  const currentQ = questions[currentQuestionIdx];
  const currentResp = responses[currentQ.id];

  const handleToggleMultiSelect = (opt: string) => {
    let curr = Array.isArray(currentResp?.data) ? [...currentResp.data] : [];
    if (curr.includes(opt)) curr = curr.filter(x => x !== opt);
    else curr.push(opt);
    handleSaveResponse(currentQ.id, curr, 'ANSWERED');
  };

  const handleMatchingSelect = (leftOpt: string, rightOpt: string) => {
    let curr = Array.isArray(currentResp?.data) ? [...currentResp.data] : [];
    const idx = curr.findIndex(x => x.left === leftOpt);
    if (idx >= 0) curr[idx].right = rightOpt;
    else curr.push({ left: leftOpt, right: rightOpt });
    handleSaveResponse(currentQ.id, curr, 'ANSWERED');
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status?: QuestionStatus) => {
    switch (status) {
      case 'ANSWERED': return 'bg-green-600 text-white';
      case 'NOT_ANSWERED': return 'bg-red-600 text-white';
      case 'MARKED_FOR_REVIEW': return 'bg-purple-600 text-white';
      case 'ANSWERED_AND_MARKED_FOR_REVIEW': return 'bg-purple-600 text-white border-2 border-green-500';
      default: return 'bg-cream text-ink border border-border-soft';
    }
  };

  const renderPaletteContent = (closeOnSelect = false) => (
    <>
      <div className="p-4 border-b border-border-soft bg-cream/20 flex items-center justify-between">
        <h3 className="font-bold text-ink text-base font-serif">Question Palette</h3>
        {closeOnSelect && (
          <button
            type="button"
            aria-label="Close question palette"
            onClick={() => setShowMobilePalette(false)}
            className="px-3 py-1.5 rounded-lg border border-border-soft text-xs font-bold text-ink hover:bg-cream cursor-pointer"
          >
            Close
          </button>
        )}
      </div>
      
      <div className="p-4 border-b border-border-soft text-xs font-semibold space-y-2.5 bg-white text-gray-body">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center space-x-2"><div className="w-5 h-5 shrink-0 bg-green-600 rounded text-white flex items-center justify-center font-bold">✓</div><span>Answered</span></div>
          <div className="flex items-center space-x-2"><div className="w-5 h-5 shrink-0 bg-red-600 rounded text-white flex items-center justify-center font-bold">✗</div><span>Not Answered</span></div>
          <div className="flex items-center space-x-2"><div className="w-5 h-5 shrink-0 bg-cream border border-border-soft rounded text-ink flex items-center justify-center font-bold">•</div><span>Not Visited</span></div>
          <div className="flex items-center space-x-2"><div className="w-5 h-5 shrink-0 bg-purple-600 rounded text-white flex items-center justify-center font-bold">?</div><span>Review</span></div>
        </div>
      </div>

      <div className="p-4 sm:p-6 flex-1 overflow-y-auto bg-cream/10">
        <div className="grid grid-cols-5 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {questions.map((q, idx) => {
            const status = responses[q.id]?.status;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => {
                  setCurrentQuestionIdx(idx);
                  if (closeOnSelect) setShowMobilePalette(false);
                }}
                className={`w-11 h-11 rounded-lg font-bold flex items-center justify-center transition-all shadow-sm hover:scale-105 active:scale-95 text-sm cursor-pointer ${getStatusColor(status)} ${currentQuestionIdx === idx ? 'ring-2 ring-maroon ring-offset-2 scale-110' : ''}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 border-t border-border-soft bg-white text-center">
        <button
          type="button"
          onClick={() => {
            if (closeOnSelect) setShowMobilePalette(false);
            void handleSubmit();
          }}
          className="w-full min-h-[44px] py-3 bg-maroon text-white hover:bg-maroon-deep font-bold rounded-full shadow-sm transition-colors cursor-pointer"
        >
          Finish & Submit Exam
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-[100dvh] h-[100dvh] bg-[#FDFBF7] flex flex-col font-sans text-ink overflow-hidden">
      <header className="bg-white border-b border-border-soft px-3 py-2.5 sm:px-6 sm:py-4 flex justify-between items-center gap-2 sm:gap-4 shadow-sm shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-sm sm:text-xl font-serif font-bold text-ink truncate">{quizDetails?.title || 'Examination'}</h1>
          <div className="text-[11px] sm:text-xs font-semibold text-gray-body mt-0.5 truncate">Subject: {quizDetails?.subject || 'N/A'}</div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <div className="hidden sm:flex items-center space-x-2">
            {saving ? (
              <span className="text-yellow-700 text-sm font-semibold flex items-center">
                <span className="animate-pulse w-2 h-2 bg-yellow-500 rounded-full mr-2"></span> Saving...
              </span>
            ) : (
              <span className="text-green-700 text-sm font-semibold flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span> Saved
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowMobilePalette(true)}
            className="lg:hidden px-2.5 py-1.5 rounded-lg border border-border-soft bg-cream/60 text-xs font-bold text-ink hover:bg-cream shrink-0 cursor-pointer"
            aria-label="Open question palette"
          >
            Q {currentQuestionIdx + 1}/{questions.length}
          </button>
          <div className="text-sm sm:text-2xl font-mono font-bold text-maroon bg-cream px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-border-soft tabular-nums">
            {formatTime(timeLeft)}
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col lg:border-r border-border-soft bg-white">
          <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <div className="flex justify-between items-center gap-2 border-b border-border-soft pb-3 sm:pb-4 mb-4 sm:mb-6">
              <h2 className="text-base sm:text-xl font-serif font-bold text-ink">Question {currentQuestionIdx + 1} of {questions.length}</h2>
              <span className="bg-maroon/10 text-maroon border border-maroon/20 px-2.5 py-1 rounded-full text-xs font-bold shrink-0">
                {currentQ.marks} Marks
              </span>
            </div>
            
            <div className="prose max-w-none mb-5 sm:mb-8 text-ink font-semibold text-base sm:text-lg leading-relaxed break-words">
              {currentQ.text}
            </div>
            {currentQ.image && (
              <div className="mb-6 sm:mb-8 space-y-2">
                {imageStatus === 'loading' && (
                  <div className="h-40 w-full max-w-md rounded-xl border border-border-soft bg-cream/40 animate-pulse flex items-center justify-center text-xs font-semibold text-gray-body">
                    Loading question image...
                  </div>
                )}
                {imageStatus === 'error' ? (
                  <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-xs font-semibold text-red-700">
                    Question image failed to load. Please continue answering or notify your faculty member.
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setZoomedImageUrl(currentQ.image || null)}
                    className={`group relative inline-block max-w-full rounded-xl border border-border-soft bg-cream/10 overflow-hidden cursor-zoom-in ${imageStatus === 'loading' ? 'hidden' : ''}`}
                    aria-label="Enlarge question image"
                  >
                    <img
                      src={currentQ.image}
                      alt="Question illustration"
                      onLoad={() => setImageStatus('loaded')}
                      onError={() => setImageStatus('error')}
                      className="max-h-56 sm:max-h-80 lg:max-h-96 max-w-full w-auto h-auto object-contain mx-auto"
                    />
                    <span className="block sm:inline-block sm:absolute sm:bottom-2 sm:right-2 px-2.5 py-1 bg-black/70 text-white text-[11px] font-semibold sm:rounded-md">
                      Tap to zoom
                    </span>
                  </button>
                )}
              </div>
            )}

            <div className="space-y-3 sm:space-y-4">
              {currentQ.type === 'MCQ' && currentQ.options?.map((opt: string, idx: number) => (
                <label key={idx} className={`block p-3.5 sm:p-4 min-h-[48px] border rounded-xl cursor-pointer transition-colors ${currentResp?.data === opt ? 'bg-maroon/5 border-maroon' : 'bg-white border-border-soft hover:bg-cream/20'}`}>
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <input 
                      type="radio" 
                      name={`q-${currentQ.id}`} 
                      className="w-5 h-5 mt-0.5 sm:mt-0 shrink-0 text-maroon border-border-soft focus:ring-maroon cursor-pointer accent-maroon"
                      checked={currentResp?.data === opt}
                      onChange={() => handleSaveResponse(currentQ.id, opt, 'ANSWERED')}
                    />
                    <span className="text-ink text-sm sm:text-base font-semibold min-w-0 flex-1 break-words">{opt}</span>
                  </div>
                </label>
              ))}

              {currentQ.type === 'MULTI_SELECT' && currentQ.options?.map((opt: string, idx: number) => {
                const isSelected = Array.isArray(currentResp?.data) && currentResp.data.includes(opt);
                return (
                  <label key={idx} className={`block p-3.5 sm:p-4 min-h-[48px] border rounded-xl cursor-pointer transition-colors ${isSelected ? 'bg-maroon/5 border-maroon' : 'bg-white border-border-soft hover:bg-cream/20'}`}>
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 mt-0.5 sm:mt-0 shrink-0 text-maroon border-border-soft rounded focus:ring-maroon cursor-pointer accent-maroon"
                        checked={isSelected}
                        onChange={() => handleToggleMultiSelect(opt)}
                      />
                      <span className="text-ink text-sm sm:text-base font-semibold min-w-0 flex-1 break-words">{opt}</span>
                    </div>
                  </label>
                );
              })}

              {(currentQ.type === 'SHORT_WRITTEN' || currentQ.type === 'LONG_WRITTEN') && (
                <textarea 
                  className={`w-full p-3.5 sm:p-4 border border-border-soft rounded-xl focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon resize-none text-ink bg-white text-sm sm:text-base ${currentQ.type === 'LONG_WRITTEN' ? 'h-48 sm:h-64' : 'h-28 sm:h-32'}`}
                  placeholder="Type your answer here..."
                  value={currentResp?.data || ''}
                  onChange={(e) => handleSaveResponse(currentQ.id, e.target.value, 'ANSWERED')}
                />
              )}

              {currentQ.type === 'NUMERICAL' && (
                <input 
                  type="text"
                  inputMode="decimal"
                  className="w-full p-3.5 sm:p-4 border border-border-soft rounded-xl focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon text-ink bg-white text-base font-semibold"
                  placeholder="Enter the numerical value..."
                  value={currentResp?.data || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^[0-9]*\.?[0-9]*$/.test(val)) {
                      handleSaveResponse(currentQ.id, val, 'ANSWERED');
                    }
                  }}
                />
              )}

              {currentQ.type === 'MATCHING' && (() => {
                const lefts: string[] = currentQ.options?.lefts || (Array.isArray(currentQ.options) ? currentQ.options.map((o: any) => o.left) : []);
                const rights: string[] = currentQ.options?.rights || (Array.isArray(currentQ.options) ? currentQ.options.map((o: any) => o.right) : []);

                return (
                  <div className="space-y-3 sm:space-y-4">
                    {lefts.map((leftOpt: string, idx: number) => {
                      const currentArr = Array.isArray(currentResp?.data) ? currentResp.data : [];
                      const selectedRight = currentArr.find((x: any) => x.left === leftOpt)?.right || '';
                      return (
                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3.5 sm:p-4 bg-cream/20 border border-border-soft rounded-xl">
                          <div className="sm:flex-1 text-ink text-sm sm:text-base font-semibold min-w-0 break-words">{leftOpt}</div>
                          <div className="hidden sm:block text-gray-body shrink-0">→</div>
                          <select 
                            className="w-full sm:flex-1 min-w-0 min-h-[42px] p-2.5 border border-border-soft rounded-lg bg-white focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon text-ink font-semibold text-sm shadow-sm"
                            value={selectedRight}
                            onChange={(e) => handleMatchingSelect(leftOpt, e.target.value)}
                          >
                            <option value="">Select match...</option>
                            {rights.map((rightOpt: string, rIdx: number) => (
                              <option key={rIdx} value={rightOpt}>{rightOpt}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {currentQ.type === 'FILL_BLANK' && (() => {
                const blankCount = currentQ.options?.blanks?.length || (currentQ.text.match(/\[blank\]/gi) || []).length || 1;
                
                if (blankCount > 1) {
                  const currentAnswers = Array.isArray(currentResp?.data) ? currentResp.data : [];
                  return (
                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-gray-body mb-2">Fill in the answer for each blank:</div>
                      {Array.from({ length: blankCount }).map((_, bIdx) => (
                        <div key={bIdx} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 bg-cream/20 rounded-xl border border-border-soft">
                          <span className="text-sm font-bold text-maroon sm:min-w-16 shrink-0">Blank {bIdx + 1}:</span>
                          <input
                            type="text"
                            className="w-full sm:flex-1 min-w-0 min-h-[42px] p-2.5 border border-border-soft rounded-lg bg-white focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon text-ink text-sm font-medium shadow-sm"
                            placeholder={`Answer for blank ${bIdx + 1}...`}
                            value={currentAnswers[bIdx] || ''}
                            onChange={(e) => {
                              const updated = [...currentAnswers];
                              while (updated.length < blankCount) updated.push('');
                              updated[bIdx] = e.target.value;
                              handleSaveResponse(currentQ.id, updated, 'ANSWERED');
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-body block">Your Answer:</label>
                    <input
                      type="text"
                      className="w-full min-h-[44px] p-3.5 sm:p-4 border border-border-soft rounded-xl focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon text-ink bg-white text-base font-semibold shadow-sm"
                      placeholder="Type your answer here..."
                      value={typeof currentResp?.data === 'string' ? currentResp.data : (Array.isArray(currentResp?.data) ? currentResp.data[0] || '' : '')}
                      onChange={(e) => handleSaveResponse(currentQ.id, e.target.value, 'ANSWERED')}
                    />
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="bg-white border-t border-border-soft p-3 sm:p-4 flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-2.5 sm:gap-3 shadow-sm shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={handleMarkReview} className="flex-1 sm:flex-initial min-h-[42px] px-3.5 sm:px-5 py-2 border border-purple-600 text-purple-700 hover:bg-purple-50 font-bold text-xs sm:text-sm rounded-full transition-all cursor-pointer">Mark for Review & Next</button>
              <button type="button" onClick={handleClear} className="min-h-[42px] px-3.5 sm:px-5 py-2 border border-border-soft text-gray-body hover:bg-cream/40 font-bold text-xs sm:text-sm rounded-full transition-all cursor-pointer">Clear</button>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button type="button" onClick={handlePrevious} disabled={currentQuestionIdx === 0} className="flex-1 sm:flex-initial min-h-[44px] px-4 sm:px-5 py-2 bg-cream border border-border-soft text-ink hover:bg-cream-edge/30 disabled:opacity-50 font-bold text-xs sm:text-sm rounded-full transition-all cursor-pointer">Previous</button>
              <button type="button" onClick={handleNext} disabled={currentQuestionIdx === questions.length - 1} className="flex-1 sm:flex-initial min-h-[44px] px-4 sm:px-5 py-2 bg-maroon text-white hover:bg-maroon-deep disabled:opacity-50 font-bold text-xs sm:text-sm rounded-full transition-all cursor-pointer">Save & Next</button>
              {currentQuestionIdx === questions.length - 1 && (
                <button type="button" onClick={handleSubmit} className="flex-1 sm:flex-initial min-h-[44px] px-4 sm:px-6 py-2 bg-green-700 text-white hover:bg-green-800 font-bold text-xs sm:text-sm rounded-full transition-all shadow-sm cursor-pointer">Submit Exam</button>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Question Palette */}
        <div className="hidden lg:flex w-80 bg-white flex-col border-l border-border-soft shrink-0">
          {renderPaletteContent(false)}
        </div>
      </div>

      {/* Mobile / Tablet Question Palette Drawer */}
      {showMobilePalette && (
        <div
          className="fixed inset-0 z-50 bg-black/50 lg:hidden flex justify-end"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowMobilePalette(false);
          }}
        >
          <div className="w-80 max-w-[88vw] h-full bg-white flex flex-col shadow-xl">
            {renderPaletteContent(true)}
          </div>
        </div>
      )}

      {/* Question Image Lightbox */}
      {zoomedImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Zoomed question image"
          onClick={() => setZoomedImageUrl(null)}
        >
          <div className="relative max-w-[95vw] max-h-[90vh] flex flex-col items-end gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setZoomedImageUrl(null)}
              className="px-4 py-1.5 rounded-full bg-white text-black text-xs font-bold shadow cursor-pointer"
            >
              Close
            </button>
            <img
              src={zoomedImageUrl}
              alt="Question illustration enlarged"
              className="max-w-[95vw] max-h-[82vh] w-auto h-auto object-contain rounded-lg bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
