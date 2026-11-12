import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { clearDraft, clearSavedFilters, getDraftStorageKey, getFilterStorageKey, getStoredUserKey, readDraft, readSavedFilters, writeDraft, writeSavedFilters } from '@/lib/facultyPersistence';
import { apiClient } from '@/lib/apiClient';
import { downloadCsv } from '@/lib/csv';
import { useFacultyDemo } from '@/context/FacultyDemoContext';
import { facultyDemoBatches, facultyDemoDepartments, facultyDemoQuizzes } from '@/lib/facultyDemoData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Clipboard, Check, AlertCircle, Pencil, FileText, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState, ErrorState, ConfirmationDialog } from '@/components/ui/facultyPrimitives';
import { DeleteConfirmationDialog } from '@/components/ui/DeleteConfirmationDialog';

type QuizWizardStep = 1 | 2 | 3 | 4 | 5;

const QUIZ_WIZARD_STEPS: { step: QuizWizardStep; label: string; shortLabel: string; description: string }[] = [
  { step: 1, label: 'Basic Details', shortLabel: 'Basic', description: 'Enter the quiz title, course subject, and time duration.' },
  { step: 2, label: 'Schedule', shortLabel: 'Schedule', description: 'Configure optional start and end availability times.' },
  { step: 3, label: 'Marks', shortLabel: 'Marks', description: 'Set total marks (or auto-calculate) and passing marks.' },
  { step: 4, label: 'Assign Classes', shortLabel: 'Classes', description: 'Select target batches, departments, and sections.' },
  { step: 5, label: 'Add Questions', shortLabel: 'Questions', description: 'Add questions via direct paste, DOCX upload, or manual builder.' },
];

// Helper functions for parsing questions
const parseMCQs = (rawText: string): any[] => {
  if (!rawText.trim()) return [];

  const rawLines = rawText.split(/\r?\n/);
  const questionChunks: { lines: string[] }[] = [];
  let currentChunk: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;

    const isNumAlone = /^\d+[\.\)]\s*$/.test(line);
    const isNumWithText = /^\d+[\.\)]\s+/.test(line);
    const isQWithText = /^(?:Question|Q)\s*\d+[\.\:\)]/i.test(line);

    if (isNumAlone || isNumWithText || isQWithText) {
      if (currentChunk.length > 0) {
        questionChunks.push({ lines: currentChunk });
        currentChunk = [];
      }
    }
    currentChunk.push(line);
  }
  if (currentChunk.length > 0) {
    questionChunks.push({ lines: currentChunk });
  }

  const parsed: any[] = [];

  for (const chunk of questionChunks) {
    const lines = chunk.lines;
    if (lines.length === 0) continue;

    let questionText = '';
    const options: string[] = [];
    let answerKey = '';
    let startLineIdx = 0;

    if (/^\d+[\.\)]\s*$/.test(lines[0])) {
      startLineIdx = 1;
    }

    if (startLineIdx < lines.length) {
      questionText = lines[startLineIdx]
        .replace(/^\d+[\.\)]\s*/, '')
        .replace(/^(?:Question|Q)\s*\d+[\.\:\)]\s*/i, '');
      startLineIdx++;
    }

    for (let i = startLineIdx; i < lines.length; i++) {
      const line = lines[i];

      const answerMatch = line.match(/^(?:Answer|Correct|Ans|Correct Answer|Key)[\s\:\-\=]+(.*)/i);
      if (answerMatch) {
        answerKey = answerMatch[1].trim();
        continue;
      }

      const optionMatch = line.match(/^(?:[\(\[]?([A-D]|[a-d]|\d+)[\)\]\.]|\b([A-D]|[a-d])\))\s*(.*)/);
      if (optionMatch) {
        options.push(optionMatch[3].trim());
      } else {
        if (options.length === 0 && !/[\?\:]\s*$/.test(questionText) && i === startLineIdx) {
          questionText += ' ' + line;
        } else {
          options.push(line);
        }
      }
    }

    let correctOptionText = '';
    if (answerKey) {
      if (/^[A-D]$/i.test(answerKey)) {
        const letterIndex = answerKey.toUpperCase().charCodeAt(0) - 65;
        if (letterIndex >= 0 && letterIndex < options.length) {
          correctOptionText = options[letterIndex];
        }
      } else if (/^\d+$/.test(answerKey)) {
        const numIndex = parseInt(answerKey) - 1;
        if (!isNaN(numIndex) && numIndex >= 0 && numIndex < options.length) {
          correctOptionText = options[numIndex];
        }
      } else {
        const matchedOpt = options.find(o => o.toLowerCase() === answerKey.toLowerCase());
        if (matchedOpt) correctOptionText = matchedOpt;
        else correctOptionText = answerKey;
      }
    }

    for (let idx = 0; idx < options.length; idx++) {
      if (options[idx].toLowerCase().includes('(correct)') || options[idx].toLowerCase().includes('(answer)')) {
        options[idx] = options[idx].replace(/\s*\(correct\)/i, '').replace(/\s*\(answer\)/i, '').trim();
        correctOptionText = options[idx];
      }
    }

    while (options.length < 4) {
      options.push('');
    }

    parsed.push({
      type: 'MCQ',
      text: questionText.trim(),
      marks: 1,
      options: options,
      answerKey: correctOptionText || '',
      topic: ''
    });
  }

  return parsed;
};

const parseShortWritten = (rawText: string): any[] => {
  if (!rawText.trim()) return [];
  const rawLines = rawText.split(/\r?\n/);
  const questionChunks: { lines: string[] }[] = [];
  let currentChunk: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;

    const isNumAlone = /^\d+[\.\)]\s*$/.test(line);
    const isNumWithText = /^\d+[\.\)]\s+/.test(line);
    const isQWithText = /^(?:Question|Q)\s*\d+[\.\:\)]/i.test(line);

    if (isNumAlone || isNumWithText || isQWithText) {
      if (currentChunk.length > 0) {
        questionChunks.push({ lines: currentChunk });
        currentChunk = [];
      }
    }
    currentChunk.push(line);
  }
  if (currentChunk.length > 0) {
    questionChunks.push({ lines: currentChunk });
  }

  const parsed: any[] = [];
  for (const chunk of questionChunks) {
    const lines = chunk.lines;
    if (lines.length === 0) continue;

    let startLineIdx = 0;
    if (/^\d+[\.\)]\s*$/.test(lines[0])) startLineIdx = 1;

    let questionText = '';
    if (startLineIdx < lines.length) {
      questionText = lines[startLineIdx].replace(/^\d+[\.\)]\s*/, '').replace(/^(?:Question|Q)\s*\d+[\.\:\)]\s*/i, '');
      startLineIdx++;
    }

    let answerKey = '';
    let foundAnswer = false;

    for (let i = startLineIdx; i < lines.length; i++) {
      const line = lines[i];
      const answerMatch = line.match(/^(?:Answer|Correct|Ans|Expected Answer)[\s\:\-\=]+(.*)/i);
      if (answerMatch) {
        answerKey = answerMatch[1].trim();
        foundAnswer = true;
      } else {
        if (foundAnswer) {
          answerKey += '\n' + line;
        } else {
          questionText += '\n' + line;
        }
      }
    }

    parsed.push({
      type: 'SHORT_WRITTEN',
      text: questionText.trim(),
      marks: 2,
      options: null,
      answerKey: answerKey,
      topic: ''
    });
  }
  return parsed;
};

const parseNumerical = (rawText: string): any[] => {
  if (!rawText.trim()) return [];
  const rawLines = rawText.split(/\r?\n/);
  const questionChunks: { lines: string[] }[] = [];
  let currentChunk: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;

    const isNumAlone = /^\d+[\.\)]\s*$/.test(line);
    const isNumWithText = /^\d+[\.\)]\s+/.test(line);
    const isQWithText = /^(?:Question|Q)\s*\d+[\.\:\)]/i.test(line);

    if (isNumAlone || isNumWithText || isQWithText) {
      if (currentChunk.length > 0) {
        questionChunks.push({ lines: currentChunk });
        currentChunk = [];
      }
    }
    currentChunk.push(line);
  }
  if (currentChunk.length > 0) {
    questionChunks.push({ lines: currentChunk });
  }

  const parsed: any[] = [];
  for (const chunk of questionChunks) {
    const lines = chunk.lines;
    if (lines.length === 0) continue;

    let startLineIdx = 0;
    if (/^\d+[\.\)]\s*$/.test(lines[0])) startLineIdx = 1;

    let questionText = '';
    if (startLineIdx < lines.length) {
      questionText = lines[startLineIdx].replace(/^\d+[\.\)]\s*/, '').replace(/^(?:Question|Q)\s*\d+[\.\:\)]\s*/i, '');
      startLineIdx++;
    }

    let answerKey = '';

    for (let i = startLineIdx; i < lines.length; i++) {
      const line = lines[i];
      const answerMatch = line.match(/^(?:Answer|Correct|Ans)[\s\:\-\=]+([\d\.]+)/i);
      if (answerMatch) {
        answerKey = answerMatch[1].trim();
      } else {
        questionText += '\n' + line;
      }
    }

    parsed.push({
      type: 'NUMERICAL',
      text: questionText.trim(),
      marks: 1,
      options: null,
      answerKey: answerKey ? Number(answerKey) : '',
      topic: ''
    });
  }
  return parsed;
};

const formatDateTimeLocal = (value: string | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  const pad = (part: number) => part.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const parseLongWritten = (rawText: string): any[] => {
  if (!rawText.trim()) return [];
  const rawLines = rawText.split(/\r?\n/);
  const questionChunks: { lines: string[] }[] = [];
  let currentChunk: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;

    const isNumAlone = /^\d+[\.\)]\s*$/.test(line);
    const isNumWithText = /^\d+[\.\)]\s+/.test(line);
    const isQWithText = /^(?:Question|Q)\s*\d+[\.\:\)]/i.test(line);

    if (isNumAlone || isNumWithText || isQWithText) {
      if (currentChunk.length > 0) {
        questionChunks.push({ lines: currentChunk });
        currentChunk = [];
      }
    }
    currentChunk.push(line);
  }
  if (currentChunk.length > 0) {
    questionChunks.push({ lines: currentChunk });
  }

  const parsed: any[] = [];
  for (const chunk of questionChunks) {
    const lines = chunk.lines;
    if (lines.length === 0) continue;

    let startLineIdx = 0;
    if (/^\d+[\.\)]\s*$/.test(lines[0])) startLineIdx = 1;

    let questionText = '';
    if (startLineIdx < lines.length) {
      questionText = lines[startLineIdx].replace(/^\d+[\.\)]\s*/, '').replace(/^(?:Question|Q)\s*\d+[\.\:\)]\s*/i, '');
      startLineIdx++;
    }

    let answerKey = '';
    let foundAnswer = false;

    for (let i = startLineIdx; i < lines.length; i++) {
      const line = lines[i];
      const answerMatch = line.match(/^(?:Answer|Correct|Ans|Expected Answer)[\s\:\-\=]+(.*)/i);
      if (answerMatch) {
        answerKey = answerMatch[1].trim();
        foundAnswer = true;
      } else {
        if (foundAnswer) {
          answerKey += '\n' + line;
        } else {
          questionText += '\n' + line;
        }
      }
    }

    parsed.push({
      type: 'LONG_WRITTEN',
      text: questionText.trim(),
      marks: 5,
      options: null,
      answerKey: answerKey,
      topic: ''
    });
  }
  return parsed;
};

const parseMatching = (rawText: string): any[] => {
  if (!rawText.trim()) return [];
  const rawLines = rawText.split(/\r?\n/);
  const questionChunks: { lines: string[] }[] = [];
  let currentChunk: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;

    const isNumAlone = /^\d+[\.\)]\s*$/.test(line);
    const isNumWithText = /^\d+[\.\)]\s+/.test(line);
    const isQWithText = /^(?:Question|Q)\s*\d+[\.\:\)]/i.test(line);

    if (isNumAlone || isNumWithText || isQWithText) {
      if (currentChunk.length > 0) {
        questionChunks.push({ lines: currentChunk });
        currentChunk = [];
      }
    }
    currentChunk.push(line);
  }
  if (currentChunk.length > 0) {
    questionChunks.push({ lines: currentChunk });
  }

  const parsed: any[] = [];
  for (const chunk of questionChunks) {
    const lines = chunk.lines;
    if (lines.length === 0) continue;

    let startLineIdx = 0;
    if (/^\d+[\.\)]\s*$/.test(lines[0])) startLineIdx = 1;

    let questionText = '';
    const pairs: { left: string; right: string }[] = [];

    for (let i = startLineIdx; i < lines.length; i++) {
      const line = lines[i];
      // Check for matching pair formats like:
      // "Term A -> Def A" or "Term A = Def A" or "1. Term -> Def"
      const pairMatch = line.match(/^(?:(?:\d+|[A-Za-z])[\.\)]\s*)?(.+?)\s*(?:->|=>|=|:)\s*(.+)$/);
      if (pairMatch && pairMatch[1].trim() && pairMatch[2].trim() && !line.toLowerCase().startsWith('question') && !line.toLowerCase().startsWith('marks')) {
        pairs.push({
          left: pairMatch[1].replace(/^\d+[\.\)]\s*/, '').trim(),
          right: pairMatch[2].replace(/^[A-Za-z0-9][\.\)]\s*/, '').trim()
        });
      } else {
        if (pairs.length === 0) {
          questionText += (questionText ? '\n' : '') + line.replace(/^(?:Question|Q)\s*\d+[\.\:\)]\s*/i, '');
        }
      }
    }

    if (pairs.length > 0) {
      parsed.push({
        type: 'MATCHING',
        text: questionText.trim() || 'Match the items in Column A with Column B',
        marks: Math.max(1, pairs.length),
        options: pairs,
        answerKey: pairs,
        topic: ''
      });
    }
  }
  return parsed;
};

const parseFillBlanks = (rawText: string): any[] => {
  if (!rawText.trim()) return [];
  const rawLines = rawText.split(/\r?\n/);
  const questionChunks: { lines: string[] }[] = [];
  let currentChunk: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;

    const isNumAlone = /^\d+[\.\)]\s*$/.test(line);
    const isNumWithText = /^\d+[\.\)]\s+/.test(line);
    const isQWithText = /^(?:Question|Q)\s*\d+[\.\:\)]/i.test(line);

    if (isNumAlone || isNumWithText || isQWithText) {
      if (currentChunk.length > 0) {
        questionChunks.push({ lines: currentChunk });
        currentChunk = [];
      }
    }
    currentChunk.push(line);
  }
  if (currentChunk.length > 0) {
    questionChunks.push({ lines: currentChunk });
  }

  const parsed: any[] = [];
  for (const chunk of questionChunks) {
    const lines = chunk.lines;
    if (lines.length === 0) continue;

    let startLineIdx = 0;
    if (/^\d+[\.\)]\s*$/.test(lines[0])) startLineIdx = 1;

    let questionText = '';
    let answerKey = '';

    for (let i = startLineIdx; i < lines.length; i++) {
      const line = lines[i];
      const answerMatch = line.match(/^(?:Answer|Correct|Ans|Expected Answer|Key)[\s\:\-\=]+(.*)/i);
      if (answerMatch) {
        answerKey = answerMatch[1].trim();
      } else {
        questionText += (questionText ? '\n' : '') + line.replace(/^(?:Question|Q)\s*\d+[\.\:\)]\s*/i, '');
      }
    }

    // If faculty used underscores like _____ instead of [blank], convert them
    let normalizedText = questionText.trim();
    if (!normalizedText.includes('[blank]') && /_{3,}/.test(normalizedText)) {
      normalizedText = normalizedText.replace(/_{3,}/g, '[blank]');
    }

    parsed.push({
      type: 'FILL_BLANK',
      text: normalizedText,
      marks: 1,
      options: null,
      answerKey: answerKey || '',
      topic: ''
    });
  }
  return parsed;
};

export default function QuizManagement({ initialSubmissionsQuizId }: { initialSubmissionsQuizId?: string | null } = {}) {
  const isDemo = useFacultyDemo();
  const [activeView, setActiveView] = useState<'list' | 'create' | 'add_questions' | 'view_submissions' | 'evaluate_attempt' | 'print_paper'>('list');
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const quizFilterKey = getFilterStorageKey('quizzes', getStoredUserKey());
  const savedQuizFilters = readSavedFilters<{ search?: string }>(quizFilterKey);
  const [quizSearch, setQuizSearch] = useState(savedQuizFilters?.search || '');
  const [batches, setBatches] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [quizzesLoading, setQuizzesLoading] = useState(() => !isDemo);
  const [loadingMoreQuizzes, setLoadingMoreQuizzes] = useState(false);
  const [quizzesError, setQuizzesError] = useState<string | null>(null);
  const [hasFetchedQuizzes, setHasFetchedQuizzes] = useState(() => isDemo);
  const [editingQuizIdLoading, setEditingQuizIdLoading] = useState<string | null>(null);
  const [printingQuizIdLoading, setPrintingQuizIdLoading] = useState<string | null>(null);
  const [printQuiz, setPrintQuiz] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const isMountedRef = useRef(true);
  const quizzesRequestIdRef = useRef(0);
  const submissionsRequestIdRef = useRef(0);
  
  const getInitialFacultySubject = () => {
    try {
      const stored = localStorage.getItem('cira_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.subject) return parsed.subject;
      }
    } catch {}
    return '';
  };

  const initialSubject = getInitialFacultySubject();
  const [facultySubject, setFacultySubject] = useState<string>(initialSubject);

  // Create Form State
  const [formData, setFormData] = useState({
    title: '', subject: initialSubject, description: '', totalMarks: '', passingMarks: '',
    durationMinutes: '60', startDate: '', endDate: '',
    targetDepartments: [] as string[], targetSections: [] as string[],
  });
  const [wizardStep, setWizardStep] = useState<QuizWizardStep>(1);
  const [completedWizardSteps, setCompletedWizardSteps] = useState<QuizWizardStep[]>([]);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Template Config State
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateConfig, setTemplateConfig] = useState({
    totalQuestions: 10,
    isMixedTypes: false,
    mcqCount: 10,
    numericalCount: 0,
    shortCount: 0,
    longCount: 0,
    matchingCount: 0,
    fillBlankCount: 0
  });

  // Questions & Submissions State
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([{ type: 'MCQ', text: '', marks: 1, options: ['', '', '', ''], answerKey: '', topic: '' }]);

  // Bulk Import State
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkConfig, setBulkConfig] = useState<Record<string, { selected: boolean; text: string }>>({
    MCQ: { selected: false, text: '' },
    SHORT_WRITTEN: { selected: false, text: '' },
    NUMERICAL: { selected: false, text: '' },
    LONG_WRITTEN: { selected: false, text: '' },
    MATCHING: { selected: false, text: '' },
    FILL_BLANK: { selected: false, text: '' },
  });

  // Grading & Publication State
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [assignedClasses, setAssignedClasses] = useState<{ id: string; label: string; shortLabel?: string }[]>([]);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState<'ALL' | 'SUBMITTED' | 'NOT_SUBMITTED' | 'VIOLATED'>('ALL');
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  const [restartingAttemptId, setRestartingAttemptId] = useState<string | null>(null);
  const [activeSubmissionsQuiz, setActiveSubmissionsQuiz] = useState<{
    id: string;
    title: string;
    subject?: string | null;
    totalMarks?: number;
    answersPublished: boolean;
  } | null>(null);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [publishingAnswers, setPublishingAnswers] = useState(false);
  const [quizPendingDelete, setQuizPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [attemptPendingRestart, setAttemptPendingRestart] = useState<{ attemptId: string; studentName: string } | null>(null);
  const [activeAttempt, setActiveAttempt] = useState<any>(null);
  const [evaluations, setEvaluations] = useState<Record<string, number>>({});
  const [facultyFeedback, setFacultyFeedback] = useState('');
  const [parsedTotalMarks, setParsedTotalMarks] = useState(0);
  const [parsedTotalQuestions, setParsedTotalQuestions] = useState(0);
  const [restoredQuizDraft, setRestoredQuizDraft] = useState(false);
  const skipQuizDraftWrite = useRef(false);
  const quizDraftKey = getDraftStorageKey('quiz', activeQuizId || 'new', getStoredUserKey());

  useEffect(() => {
    if (activeView !== 'create') return;
    const draft = readDraft<{
      formData: typeof formData;
      questions: any[];
    }>(quizDraftKey);
    if (draft) {
      if (draft.formData && typeof draft.formData === 'object') setFormData(draft.formData);
      if (Array.isArray(draft.questions)) setQuestions(draft.questions);
      setRestoredQuizDraft(true);
    } else {
      setRestoredQuizDraft(false);
    }
  }, [activeView, quizDraftKey]);

  useEffect(() => {
    if (activeView !== 'create') return;
    if (skipQuizDraftWrite.current) {
      skipQuizDraftWrite.current = false;
      return;
    }
    const timeout = window.setTimeout(() => writeDraft(quizDraftKey, { formData, questions }), 500);
    return () => window.clearTimeout(timeout);
  }, [activeView, formData, questions, quizDraftKey]);

  useEffect(() => {
    writeSavedFilters(quizFilterKey, { search: quizSearch });
  }, [quizFilterKey, quizSearch]);

  useEffect(() => {
    // Automatically retrieve Subject/Course from logged-in faculty profile
    const fetchFacultyProfile = async () => {
      try {
        const storedUserRaw = localStorage.getItem('cira_user');
        if (storedUserRaw) {
          const userObj = JSON.parse(storedUserRaw);
          if (userObj?.subject) {
            setFacultySubject(userObj.subject);
            setFormData(prev => prev.subject ? prev : { ...prev, subject: userObj.subject });
          }
        }

        const res = await apiClient.fetch('/api/v1/auth/me');
        const data = await res.json();
        if (data?.data?.user?.subject) {
          const subj = data.data.user.subject;
          setFacultySubject(subj);
          setFormData(prev => prev.subject ? prev : { ...prev, subject: subj });
        }
      } catch (err) {
        console.error('Failed to fetch faculty subject profile', err);
      }
    };
    fetchFacultyProfile();
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchBatches = async () => {
    try {
      if (isDemo) {
        if (isMountedRef.current) setBatches(facultyDemoBatches);
        return;
      }
      const res = await apiClient.fetch('/api/v1/batches');
      const data = await res.json();
      if (isMountedRef.current && data?.data?.batches) setBatches(data.data.batches);
    } catch (err) {
      console.error('Failed to fetch batches', err);
    }
  };

  const fetchQuizzes = useCallback(async (pageNumber = 1) => {
    const requestId = ++quizzesRequestIdRef.current;
    const isInitialPage = pageNumber === 1;

    if (isDemo) {
      setQuizzes(facultyDemoQuizzes);
      setHasMore(false);
      setPage(1);
      setQuizzesError(null);
      setHasFetchedQuizzes(true);
      setQuizzesLoading(false);
      setLoadingMoreQuizzes(false);
      return;
    }

    if (isInitialPage) {
      setQuizzesLoading(true);
      setQuizzesError(null);
    } else {
      setLoadingMoreQuizzes(true);
    }

    try {
      const res = await apiClient.fetch(`/api/v1/faculty/quiz?page=${pageNumber}&limit=10`);
      if (!isMountedRef.current || requestId !== quizzesRequestIdRef.current) return;
      if (res?.ok === false) {
        throw new Error('Unable to load quizzes. Please try again.');
      }
      const data = await res.json();
      if (!isMountedRef.current || requestId !== quizzesRequestIdRef.current) return;
      if (data?.status === 'error' || !data?.data) {
        throw new Error(data?.message || 'Unable to load quizzes. Please try again.');
      }

      const fetchedQuizzes = Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.data.items)
          ? data.data.items
          : [];

      if (isInitialPage) {
        setQuizzes(fetchedQuizzes);
      } else {
        setQuizzes(prev => [...prev, ...fetchedQuizzes]);
      }

      if (!Array.isArray(data.data)) {
        setHasMore(Boolean(data.data.hasMore));
        setPage(Number(data.data.page) || pageNumber);
      } else {
        setHasMore(false);
      }
      setQuizzesError(null);
      setHasFetchedQuizzes(true);
    } catch (err) {
      console.error(err);
      if (!isMountedRef.current || requestId !== quizzesRequestIdRef.current) return;
      if (isInitialPage) {
        setQuizzesError('Unable to load quizzes. Please try again.');
      } else {
        toast.error('Unable to load more quizzes. Please try again.');
      }
    } finally {
      if (isMountedRef.current && requestId === quizzesRequestIdRef.current) {
        if (isInitialPage) {
          setQuizzesLoading(false);
        } else {
          setLoadingMoreQuizzes(false);
        }
      }
    }
  }, [isDemo]);

  const fetchDepartments = async () => {
    try {
      if (isDemo) {
        if (isMountedRef.current) setDepartments(facultyDemoDepartments);
        return;
      }
      const res = await apiClient.fetch('/api/v1/departments');
      const data = await res.json();
      if (isMountedRef.current && data?.data?.departments) setDepartments(data.data.departments);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    void fetchQuizzes(1);
    void fetchBatches();
    void fetchDepartments();
  }, [fetchQuizzes, isDemo]);

  const handleEditQuiz = async (quizId: string, attemptsCount: number) => {
    if (attemptsCount > 0) {
      toast.error('Cannot edit a quiz that already has student submissions.');
      return;
    }
    if (editingQuizIdLoading) return;

    try {
      setEditingQuizIdLoading(quizId);
      setLoading(true);
      const res = await apiClient.fetch(`/api/v1/faculty/quiz/${quizId}`);
      const data = await res.json();
      if (!isMountedRef.current) return;
      if (res?.ok !== false && data?.status === 'success' && data.data) {
        const quiz = data.data;
        setFormData({
          title: quiz.title || '',
          subject: quiz.subject || facultySubject || '',
          description: quiz.description || '',
          totalMarks: quiz.totalMarks?.toString() || '',
          passingMarks: quiz.passingMarks?.toString() || '',
          durationMinutes: quiz.durationMinutes?.toString() || '60',
          startDate: formatDateTimeLocal(quiz.startDate),
          endDate: formatDateTimeLocal(quiz.endDate),
          targetDepartments: quiz.targetDepartments?.map((d: any) => d.departmentId) || [],
          targetSections: quiz.targetSections?.map((s: any) => s.sectionId) || [],
        });
        
        let fetchedQuestions = quiz.questions;
        if (!fetchedQuestions || fetchedQuestions.length === 0) {
          fetchedQuestions = [{ type: 'MCQ', text: '', marks: 1, options: ['', '', '', ''], answerKey: '', topic: '' }];
        } else {
          // Ensure options are initialized consistently for all question types
          fetchedQuestions = fetchedQuestions.map((q: any) => {
            if (!q.options) {
              q.options = q.type === 'MATCHING' ? [{ left: '', right: '' }] : ['', '', '', ''];
            }
            return q;
          });
        }
        
        setQuestions(fetchedQuestions);
        setParsedTotalMarks(Number(quiz.totalMarks) || 0);
        setParsedTotalQuestions(quiz.questions ? quiz.questions.length : 0);
        setActiveQuizId(quiz.id);
        setWizardStep(1);
        setCompletedWizardSteps([1, 2, 3, 4]);
        setStepErrors({});
        setShowDiscardConfirm(false);
        setActiveView('create');
      } else {
        toast.error('Failed to fetch quiz details for editing.');
      }
    } catch (err) {
      console.error(err);
      if (isMountedRef.current) toast.error('Error fetching quiz details.');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setEditingQuizIdLoading(null);
      }
    }
  };

  const handlePrintQuestionPaper = async (quizId: string) => {
    if (printingQuizIdLoading) return;
    if (isDemo) {
      const demoQuiz = facultyDemoQuizzes.find(item => item.id === quizId) || quizzes.find(item => item.id === quizId);
      if (!demoQuiz) {
        toast.error('Quiz not found.');
        return;
      }
      setPrintQuiz(demoQuiz);
      setActiveView('print_paper');
      setTimeout(() => window.print(), 50);
      return;
    }

    setPrintingQuizIdLoading(quizId);
    try {
      const res = await apiClient.fetch(`/api/v1/faculty/quiz/${quizId}`);
      const data = await res.json();
      if (!isMountedRef.current) return;
      if (data?.status === 'success' && data.data) {
        setPrintQuiz(data.data);
        setActiveView('print_paper');
        setTimeout(() => window.print(), 50);
      } else {
        toast.error('Failed to load question paper for printing.');
      }
    } catch (err) {
      console.error(err);
      if (isMountedRef.current) toast.error('Error loading question paper.');
    } finally {
      if (isMountedRef.current) setPrintingQuizIdLoading(null);
    }
  };

  const handleConfirmDeleteQuiz = async () => {
    if (!quizPendingDelete) return;
    const quizId = quizPendingDelete.id;
    if (isDemo) {
      setQuizzes(previous => previous.filter(quiz => quiz.id !== quizId));
      toast.success('Demo quiz deleted locally.');
      setQuizPendingDelete(null);
      return;
    }
    const res = await apiClient.fetch(`/api/v1/faculty/quiz/${quizId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!isMountedRef.current) return;
    if (res?.ok !== false && data?.status === 'success') {
      toast.success('Quiz deleted successfully.');
      setQuizzes(previous => previous.filter(quiz => quiz.id !== quizId));
      setQuizPendingDelete(null);
      void fetchQuizzes(1);
    } else {
      const msg = data?.error?.message || data?.message || 'Failed to delete quiz.';
      toast.error(msg);
      throw new Error(msg);
    }
  };

  const handleConfirmPublishAnswers = async () => {
    const quizId = activeSubmissionsQuiz?.id || activeQuizId;
    if (!quizId || publishingAnswers || activeSubmissionsQuiz?.answersPublished) return;

    if (isDemo) {
      setActiveSubmissionsQuiz(prev => prev ? { ...prev, answersPublished: true } : prev);
      setQuizzes(previous => previous.map(quiz => quiz.id === quizId ? { ...quiz, answersPublished: true } : quiz));
      setShowPublishConfirm(false);
      toast.success('Demo answers published locally.');
      return;
    }

    try {
      setPublishingAnswers(true);
      const res = await apiClient.fetch(`/api/v1/faculty/quiz/${quizId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish: true })
      });
      const data = await res.json();
      if (!isMountedRef.current) return;
      if (res?.ok !== false && data?.status === 'success') {
        toast.success('Answers published! Students can now view their results and answer keys.');
        setActiveSubmissionsQuiz(prev => prev ? { ...prev, answersPublished: true } : { id: quizId, title: data.data?.title || 'Quiz', answersPublished: true });
        setQuizzes(previous => previous.map(quiz => quiz.id === quizId ? { ...quiz, answersPublished: true } : quiz));
        setShowPublishConfirm(false);
      } else {
        toast.error(data?.message || 'Failed to publish answers.');
      }
    } catch (err) {
      console.error(err);
      if (isMountedRef.current) toast.error('Error publishing answers.');
    } finally {
      if (isMountedRef.current) setPublishingAnswers(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      let query = `count=${templateConfig.totalQuestions}`;
      if (templateConfig.isMixedTypes) {
        query += `&mcq=${templateConfig.mcqCount}&numerical=${templateConfig.numericalCount}&short=${templateConfig.shortCount}&long=${templateConfig.longCount}&matching=${templateConfig.matchingCount}&fillBlank=${templateConfig.fillBlankCount}`;
      }
      const res = await apiClient.fetch(`/api/v1/faculty/quiz/template?${query}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Quiz_Template.docx';
      a.click();
      setShowTemplateModal(false);
    } catch (err) {
      toast.error('Failed to download template');
    }
  };

  const handleUploadDocxForCreation = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const uploadData = new FormData();
    uploadData.append('file', file);
    
    setLoading(true);
    toast.info('Parsing DOCX... this might take a moment.');
    try {
      const res = await apiClient.fetch('/api/v1/faculty/quiz/upload-docx', {
        method: 'POST',
        body: uploadData
      });
      const data = await res.json();
      if (data?.status === 'success' && data.data) {
        toast.success('Document parsed successfully! Please review the quiz.');
        
        setQuestions(data.data.questions);
        setFormData(prev => ({
          ...prev,
          title: prev.title || data.data.metadata.title || '',
          subject: prev.subject || facultySubject || data.data.metadata.subject || '',
          description: prev.description || data.data.metadata.instructions || '',
          totalMarks: prev.totalMarks || data.data.metadata.totalMarks?.toString() || ''
        }));
        setParsedTotalMarks(Number(data.data.metadata.totalMarks) || 0);
        setParsedTotalQuestions(Number(data.data.metadata.totalQuestions) || 0);
        setActiveView('add_questions');
      } else {
        toast.error('Failed to parse DOCX: ' + data.message);
      }
    } catch (err) {
      console.error(err);
      toast.error('Error uploading DOCX');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const validateQuestions = () => {
    let isValid = true;
    const newQs = [...questions];
    
    // Check Total Marks
    const currentSum = newQs.reduce((acc, q) => acc + (Number(q.marks) || 0), 0);
    
    if (parsedTotalMarks && currentSum !== parsedTotalMarks) {
      toast.error(`Total Marks Mismatch: Document states ${parsedTotalMarks} marks, but questions sum to ${currentSum}.`);
      return false;
    }
    
    // Check Total Questions Count
    if (parsedTotalQuestions && newQs.length !== parsedTotalQuestions) {
      toast.error(`Question Count Mismatch: Document states ${parsedTotalQuestions} questions, but found ${newQs.length}.`);
      return false;
    }

    // Check Completeness
    newQs.forEach((q) => {
      q.validationError = null;
      if (!q.text && !q.hasImagePlaceholder && !q.image) {
        q.validationError = "Question must have either text or an image.";
        isValid = false;
      } else if (!q.answerKey && !['SHORT_WRITTEN', 'LONG_WRITTEN', 'MATCHING', 'FILL_BLANK'].includes(q.type)) {
        q.validationError = "Answer key is required.";
        isValid = false;
      } else if (q.type === 'FILL_BLANK' && (!q.answerKey || (Array.isArray(q.answerKey) && q.answerKey.every((a: any) => !String(a).trim())) || (!Array.isArray(q.answerKey) && !String(q.answerKey).trim()))) {
        q.validationError = "Expected answer is required for Fill in the Blanks.";
        isValid = false;
      } else if (!q.topic || q.topic.trim() === '') {
        q.validationError = "Topic is mandatory for every question.";
        isValid = false;
      } else if (Number(q.marks) < 0) {
        q.validationError = "Marks cannot be negative.";
        isValid = false;
      }
    });

    if (!isValid) {
      setQuestions(newQs);
      toast.error('Validation failed. Please correct the highlighted questions.');
    }
    return isValid;
  };

  const handleSaveQuizAndQuestions = async (skipQuestionValidation = false) => {
    if (loading) return;
    if (!skipQuestionValidation && !validateQuestions()) return;

    setLoading(true);
    
    try {
      const payload = { ...formData };
      if (payload.startDate) payload.startDate = new Date(payload.startDate).toISOString();
      if (payload.endDate) payload.endDate = new Date(payload.endDate).toISOString();

      const sanitizedQuestions = questions.map(q => {
        if (q.type === 'MATCHING') return { ...q, answerKey: q.options };
        return q;
      });

      if (activeQuizId) {
        // Unified Edit flow: updates quiz details, target audience, and questions
        const res = await apiClient.fetch(`/api/v1/faculty/quiz/${activeQuizId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(skipQuestionValidation ? payload : { ...payload, questions: sanitizedQuestions })
        });
        const data = await res.json();
        
        if (res?.ok !== false && data?.status === 'success') {
          toast.success('Quiz updated successfully!');
          clearDraft(quizDraftKey);
          skipQuizDraftWrite.current = true;
          setRestoredQuizDraft(false);
          setActiveView('list');
          void fetchQuizzes(1);
        } else {
          throw new Error('Failed to update quiz: ' + (data?.message || 'Unknown error'));
        }
      } else {
        // Create flow
        const res = await apiClient.fetch('/api/v1/faculty/quiz/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        let quizIdToUse = '';
        if (res?.ok !== false && data?.status === 'success') {
          quizIdToUse = data.data.id;
        } else {
          throw new Error('Failed to create quiz: ' + (data?.message || 'Unknown error'));
        }

        const qRes = await apiClient.fetch(`/api/v1/faculty/quiz/${quizIdToUse}/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questions: sanitizedQuestions })
        });
        const qData = await qRes.json();

        if (qRes?.ok !== false && qData?.status === 'success') {
          toast.success('Quiz and Questions published successfully!');
          clearDraft(quizDraftKey);
          skipQuizDraftWrite.current = true;
          setRestoredQuizDraft(false);
          setActiveView('list');
          void fetchQuizzes(1);
        } else {
           throw new Error('Failed to save questions: ' + (qData?.message || 'Unknown error'));
        }
      }
    } catch (err: any) {
      console.error(err);
      if (isMountedRef.current) toast.error(err.message || 'An error occurred while saving.');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const handleImageUpload = async (qIndex: number, file: File) => {
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);
    
    toast.info('Uploading image...');
    try {
      const res = await apiClient.fetch('/api/v1/faculty/quiz/upload-image', {
        method: 'POST',
        body: formDataUpload
      });
      const data = await res.json();
      if (data?.status === 'success' && data.data?.url) {
        toast.success('Image uploaded!');
        updateQuestion(qIndex, 'image', data.data.url);
      } else {
        toast.error('Failed to upload image');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error uploading image');
    }
  };

  const handleAddQuestionRow = () => {
    setQuestions([...questions, { type: 'MCQ', text: '', marks: 1, options: ['', '', '', ''], answerKey: '', topic: '' }]);
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    const newQs = [...questions];
    newQs[index][field] = value;
    setQuestions(newQs);
  };

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    const newQs = [...questions];
    const oldVal = newQs[qIndex].options[optIndex];
    newQs[qIndex].options[optIndex] = value;

    if (newQs[qIndex].type === 'MCQ' && newQs[qIndex].answerKey === oldVal) {
      newQs[qIndex].answerKey = value;
    } else if (newQs[qIndex].type === 'MULTI_SELECT' && Array.isArray(newQs[qIndex].answerKey)) {
      newQs[qIndex].answerKey = newQs[qIndex].answerKey.map((ans: string) => ans === oldVal ? value : ans);
    }

    setQuestions(newQs);
  };

  const updateMatchingOption = (qIndex: number, optIndex: number, field: 'left' | 'right', value: string) => {
    const newQs = [...questions];
    if (!Array.isArray(newQs[qIndex].options)) {
      newQs[qIndex].options = [{ left: '', right: '' }];
    }
    newQs[qIndex].options[optIndex][field] = value;
    setQuestions(newQs);
  };

  const handleImportBulkQuestions = () => {
    let parsedQuestions: any[] = [];
    const countSummary: string[] = [];

    if (bulkConfig.MCQ.selected && bulkConfig.MCQ.text.trim()) {
      const mcqs = parseMCQs(bulkConfig.MCQ.text);
      parsedQuestions = [...parsedQuestions, ...mcqs];
      countSummary.push(`${mcqs.length} MCQ`);
    }

    if (bulkConfig.SHORT_WRITTEN.selected && bulkConfig.SHORT_WRITTEN.text.trim()) {
      const shortWritten = parseShortWritten(bulkConfig.SHORT_WRITTEN.text);
      parsedQuestions = [...parsedQuestions, ...shortWritten];
      countSummary.push(`${shortWritten.length} Short Written`);
    }

    if (bulkConfig.NUMERICAL.selected && bulkConfig.NUMERICAL.text.trim()) {
      const numerical = parseNumerical(bulkConfig.NUMERICAL.text);
      parsedQuestions = [...parsedQuestions, ...numerical];
      countSummary.push(`${numerical.length} Numerical`);
    }

    if (bulkConfig.LONG_WRITTEN.selected && bulkConfig.LONG_WRITTEN.text.trim()) {
      const longWritten = parseLongWritten(bulkConfig.LONG_WRITTEN.text);
      parsedQuestions = [...parsedQuestions, ...longWritten];
      countSummary.push(`${longWritten.length} Long Written`);
    }

    if (bulkConfig.MATCHING?.selected && bulkConfig.MATCHING.text.trim()) {
      const matching = parseMatching(bulkConfig.MATCHING.text);
      parsedQuestions = [...parsedQuestions, ...matching];
      countSummary.push(`${matching.length} Match the Following`);
    }

    if (bulkConfig.FILL_BLANK?.selected && bulkConfig.FILL_BLANK.text.trim()) {
      const fillBlanks = parseFillBlanks(bulkConfig.FILL_BLANK.text);
      parsedQuestions = [...parsedQuestions, ...fillBlanks];
      countSummary.push(`${fillBlanks.length} Fill in the Blanks`);
    }

    if (parsedQuestions.length === 0) {
      toast.error('No valid questions parsed. Please check your formatting!');
      return;
    }

    setQuestions(prev => {
      const isDefaultSingleEmpty = prev.length === 1 && prev[0].text === '' && (!prev[0].options || prev[0].options.every((o: string) => o === '')) && prev[0].answerKey === '';
      if (isDefaultSingleEmpty) {
        return parsedQuestions;
      }
      return [...prev, ...parsedQuestions];
    });

    toast.success(`Successfully imported ${parsedQuestions.length} questions (${countSummary.join(', ')}).`);
    
    setBulkConfig({
      MCQ: { selected: false, text: '' },
      SHORT_WRITTEN: { selected: false, text: '' },
      NUMERICAL: { selected: false, text: '' },
      LONG_WRITTEN: { selected: false, text: '' },
      MATCHING: { selected: false, text: '' },
      FILL_BLANK: { selected: false, text: '' },
    });
    setShowBulkImport(false);
    setActiveView('add_questions');
  };


  const handleOpenSubmissions = async (quizId: string) => {
    const requestId = ++submissionsRequestIdRef.current;
    setActiveQuizId(quizId);
    setSubmissions([]);
    setAssignedClasses([]);
    setSelectedClassFilter('ALL');
    setSubmissionStatusFilter('ALL');
    setSubmissionsError(null);
    setSubmissionsLoading(true);
    const localQuiz = quizzes.find(q => q.id === quizId);
    if (localQuiz) {
      setActiveSubmissionsQuiz({
        id: localQuiz.id,
        title: localQuiz.title || 'Quiz',
        subject: localQuiz.subject || null,
        totalMarks: localQuiz.totalMarks,
        answersPublished: Boolean(localQuiz.answersPublished)
      });
    } else {
      setActiveSubmissionsQuiz(null);
    }
    setActiveView('view_submissions');
    try {
      const res = await apiClient.fetch(`/api/v1/faculty/quiz/${quizId}/submissions`);
      if (!isMountedRef.current || requestId !== submissionsRequestIdRef.current) return;
      if (res?.ok === false) {
        throw new Error('Unable to load submissions. Please try again.');
      }
      const data = await res.json();
      if (!isMountedRef.current || requestId !== submissionsRequestIdRef.current) return;
      if (data?.status === 'error') {
        throw new Error(data?.message || 'Unable to load submissions. Please try again.');
      }
      if (data?.status === 'success') {
        const rawList = Array.isArray(data.roster)
          ? data.roster
          : Array.isArray(data.data)
          ? data.data.map((sub: any) => {
              const deptName = sub.user?.department?.name || '';
              const secName = sub.user?.section?.name || '';
              const classKey = sub.classKey || (sub.user?.sectionId ? `section:${sub.user.sectionId}` : sub.user?.departmentId ? `dept:${sub.user.departmentId}` : 'unassigned');
              const shortLabel = sub.classShortLabel || (secName ? `${deptName || 'Department'} – ${secName}` : deptName);
              return {
                ...sub,
                userId: sub.userId || sub.user?.id || sub.id,
                hasSubmitted: sub.hasSubmitted !== undefined ? Boolean(sub.hasSubmitted) : sub.status !== 'IN_PROGRESS' && sub.status !== 'NOT_SUBMITTED',
                classKey,
                classLabel: sub.classLabel || shortLabel || 'Unassigned',
                classShortLabel: shortLabel || sub.classLabel || '',
              };
            })
          : [];
        setSubmissions(rawList);

        if (Array.isArray(data.assignedClasses)) {
          setAssignedClasses(data.assignedClasses);
        } else {
          const derivedClasses = new Map<string, { id: string; label: string; shortLabel?: string }>();
          for (const row of rawList) {
            if (row.classKey && row.classKey !== 'unassigned' && !derivedClasses.has(row.classKey)) {
              derivedClasses.set(row.classKey, {
                id: row.classKey,
                label: row.classLabel || row.classShortLabel || row.classKey,
                shortLabel: row.classShortLabel || row.classLabel,
              });
            }
          }
          setAssignedClasses(Array.from(derivedClasses.values()));
        }

        if (data.quiz) {
          setActiveSubmissionsQuiz({
            id: data.quiz.id,
            title: data.quiz.title,
            subject: data.quiz.subject,
            totalMarks: data.quiz.totalMarks,
            answersPublished: Boolean(data.quiz.answersPublished)
          });
        }
      }
    } catch (err) {
      console.error(err);
      if (!isMountedRef.current || requestId !== submissionsRequestIdRef.current) return;
      setSubmissionsError('Unable to load quiz submissions. Please try again.');
      toast.error('Failed to load quiz submissions.');
    } finally {
      if (isMountedRef.current && requestId === submissionsRequestIdRef.current) {
        setSubmissionsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (initialSubmissionsQuizId) void handleOpenSubmissions(initialSubmissionsQuizId);
  }, [initialSubmissionsQuizId]);

  const handleOpenAttempt = (attempt: any) => {
    setActiveAttempt(attempt);
    setFacultyFeedback(attempt.facultyFeedback || '');
    const initialEvals: Record<string, number> = {};
    attempt.responses?.forEach((r: any) => {
      initialEvals[r.id] = r.marksAwarded || 0;
    });
    setEvaluations(initialEvals);
    setActiveView('evaluate_attempt');
  };

  const handleSaveEvaluation = async () => {
    try {
      setLoading(true);
      const evalsArray = Object.keys(evaluations).map(respId => ({ responseId: respId, marks: evaluations[respId] }));
      const res = await apiClient.fetch(`/api/v1/faculty/quiz/attempt/${activeAttempt.id}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluations: evalsArray, facultyFeedback })
      });
      const data = await res.json();
      if (data?.status === 'success') {
        toast.success('Evaluation saved!');
        handleOpenSubmissions(activeQuizId!);
      } else toast.error('Error: ' + data.message);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  // Creation mode tab
  const [creationMode, setCreationMode] = useState<'paste' | 'docx' | 'manual'>('paste');

  const visibleQuizzes = quizzes.filter(quiz => `${quiz.title || ''} ${quiz.subject || ''}`.toLowerCase().includes(quizSearch.toLowerCase()));

  const validateWizardStep = (step: QuizWizardStep): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (step === 1) {
      if (!formData.title.trim()) {
        errors.title = 'Quiz title is required.';
      }
      const effectiveSubject = (formData.subject || facultySubject || '').trim();
      if (!effectiveSubject) {
        errors.subject = 'Subject / Course is required.';
      }
      const durationText = formData.durationMinutes?.toString().trim() || '';
      const duration = Number(durationText);
      if (!durationText || !Number.isFinite(duration) || duration <= 0 || !Number.isInteger(duration)) {
        errors.durationMinutes = 'Enter a valid duration in minutes (greater than 0).';
      }
    } else if (step === 2) {
      const startValid = !formData.startDate || !Number.isNaN(new Date(formData.startDate).getTime());
      const endValid = !formData.endDate || !Number.isNaN(new Date(formData.endDate).getTime());
      if (!startValid) errors.startDate = 'Enter a valid start date and time.';
      if (!endValid) errors.endDate = 'Enter a valid end date and time.';
      if (formData.startDate && formData.endDate && startValid && endValid) {
        if (new Date(formData.endDate) <= new Date(formData.startDate)) {
          errors.endDate = 'End time must be later than start time.';
        }
      }
    } else if (step === 3) {
      const totalRaw = formData.totalMarks?.toString().trim() || '';
      const passingRaw = formData.passingMarks?.toString().trim() || '';
      const total = Number(totalRaw);
      const passing = Number(passingRaw);
      if (totalRaw !== '' && (!Number.isFinite(total) || total <= 0)) {
        errors.totalMarks = 'Total marks must be greater than 0.';
      }
      if (passingRaw !== '' && (!Number.isFinite(passing) || passing < 0)) {
        errors.passingMarks = 'Passing marks cannot be negative.';
      }
      if (
        totalRaw !== '' &&
        passingRaw !== '' &&
        Number.isFinite(total) &&
        total > 0 &&
        Number.isFinite(passing) &&
        passing >= 0 &&
        passing > total
      ) {
        errors.passingMarks = 'Passing marks cannot exceed total marks.';
      }
    }
    return errors;
  };

  const handleNextWizardStep = () => {
    const errors = validateWizardStep(wizardStep);
    if (Object.keys(errors).length > 0) {
      setStepErrors(errors);
      toast.error(Object.values(errors)[0]);
      return;
    }
    setStepErrors({});
    setCompletedWizardSteps(prev => (prev.includes(wizardStep) ? prev : [...prev, wizardStep]));
    if (wizardStep < 5) {
      setWizardStep((wizardStep + 1) as QuizWizardStep);
    }
  };

  const handlePrevWizardStep = () => {
    setStepErrors({});
    if (wizardStep > 1) {
      setWizardStep((wizardStep - 1) as QuizWizardStep);
    }
  };

  const handleJumpToWizardStep = (targetStep: QuizWizardStep) => {
    if (targetStep === wizardStep) return;
    const isReachable =
      targetStep < wizardStep ||
      completedWizardSteps.includes(targetStep) ||
      completedWizardSteps.includes((targetStep - 1) as QuizWizardStep);
    if (!isReachable) {
      const errors = validateWizardStep(wizardStep);
      setStepErrors(errors);
      toast.error(Object.values(errors)[0] || 'Please complete the current step before proceeding.');
      return;
    }
    setStepErrors({});
    setWizardStep(targetStep);
  };

  const hasUnsavedWizardChanges = !activeQuizId && Boolean(
    formData.title.trim() ||
    formData.totalMarks.toString().trim() ||
    formData.passingMarks.toString().trim() ||
    formData.startDate ||
    formData.endDate ||
    formData.durationMinutes !== '60' ||
    formData.targetDepartments.length > 0 ||
    formData.targetSections.length > 0 ||
    Object.values(bulkConfig).some(c => c.text.trim().length > 0) ||
    questions.length > 1 ||
    questions[0]?.text?.trim()
  );

  const handleRequestCancelWizard = () => {
    if (hasUnsavedWizardChanges) {
      setShowDiscardConfirm(true);
      return;
    }
    setStepErrors({});
    setActiveView('list');
  };

  const handleDiscardWizardChanges = () => {
    setShowDiscardConfirm(false);
    setStepErrors({});
    setActiveView('list');
  };

  if (activeView === 'create') {
    const currentStepMeta = QUIZ_WIZARD_STEPS.find(s => s.step === wizardStep)!;
    const hasStagedQuestions = questions.some(q => Boolean(q.text?.trim() || q.image));

    return (
      <>
      <Card className="bg-white dark:bg-[#1E1E22] border border-border-soft text-ink shadow-sm rounded-xl">
        <CardContent className="p-6">
          <div className="flex flex-wrap justify-between items-start gap-4 mb-5 pb-4 border-b border-border-soft">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-2xl font-serif font-bold text-ink">{activeQuizId ? 'Edit Quiz' : 'Schedule & Create Quiz'}</h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-cream text-maroon border border-maroon/20">
                  Step {wizardStep} of 5
                </span>
              </div>
              <p className="text-gray-body text-xs mt-1">{currentStepMeta.description}</p>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" onClick={handleRequestCancelWizard} variant="ghost" className="text-xs font-semibold text-gray-body">Cancel</Button>
            </div>
          </div>

          {/* 5-Step Progress Indicator */}
          <nav aria-label="Quiz creation steps" className="mb-6">
            {/* Desktop Stepper */}
            <ol className="hidden md:grid grid-cols-5 gap-2">
              {QUIZ_WIZARD_STEPS.map((item) => {
                const isCurrent = item.step === wizardStep;
                const isCompleted = completedWizardSteps.includes(item.step) && !isCurrent;
                const isReachable =
                  item.step <= wizardStep ||
                  completedWizardSteps.includes(item.step) ||
                  completedWizardSteps.includes((item.step - 1) as QuizWizardStep);

                return (
                  <li key={item.step}>
                    <button
                      type="button"
                      onClick={() => handleJumpToWizardStep(item.step)}
                      aria-current={isCurrent ? 'step' : undefined}
                      disabled={!isReachable}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                        isCurrent
                          ? 'bg-maroon text-white border-maroon shadow-sm'
                          : isCompleted
                          ? 'bg-cream/60 dark:bg-[#242429] text-ink border-maroon/30 hover:bg-cream cursor-pointer'
                          : isReachable
                          ? 'bg-white dark:bg-[#1E1E22] text-ink border-border-soft hover:bg-cream/30 cursor-pointer'
                          : 'bg-cream/20 dark:bg-[#18181B] text-gray-body border-border-soft opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          isCurrent
                            ? 'bg-white text-maroon'
                            : isCompleted
                            ? 'bg-maroon text-white'
                            : 'bg-cream text-gray-body border border-border-soft'
                        }`}
                      >
                        {isCompleted ? <Check className="w-3.5 h-3.5" /> : item.step}
                      </span>
                      <span className="min-w-0 truncate text-xs font-bold">{item.step}. {item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {/* Mobile Stepper */}
            <div className="md:hidden bg-cream/30 dark:bg-[#242429] border border-border-soft rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-ink">
                <span>Step {wizardStep} of 5: {currentStepMeta.label}</span>
                <span className="text-maroon">{Math.round((wizardStep / 5) * 100)}%</span>
              </div>
              <div className="w-full h-1.5 bg-cream rounded-full overflow-hidden">
                <div className="h-full bg-maroon transition-all duration-200" style={{ width: `${(wizardStep / 5) * 100}%` }} />
              </div>
            </div>
          </nav>

          {restoredQuizDraft && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-info/30 bg-info/5 px-3 py-2 text-sm text-ink" role="status">
              <span>Restored draft from this device.</span>
              <button type="button" className="font-semibold text-maroon underline" onClick={() => {
                clearDraft(quizDraftKey);
                skipQuizDraftWrite.current = true;
                setFormData({
                  title: '', subject: facultySubject, description: '', totalMarks: '', passingMarks: '',
                  durationMinutes: '60', startDate: '', endDate: '', targetDepartments: [], targetSections: [],
                });
                setQuestions([{ type: 'MCQ', text: '', marks: 1, options: ['', '', '', ''], answerKey: '', topic: '' }]);
                setWizardStep(1);
                setCompletedWizardSteps([]);
                setStepErrors({});
                setRestoredQuizDraft(false);
              }}>Discard</button>
            </div>
          )}

          <div key={wizardStep} className="space-y-6 transition-opacity duration-200">
            {/* Step 1: Basic Quiz Details */}
            {wizardStep === 1 && (
              <div className="bg-cream/20 dark:bg-[#242429] p-5 rounded-xl border border-border-soft space-y-4">
                <div>
                  <h3 className="text-base font-serif font-bold text-ink">Basic Quiz Details</h3>
                  <p className="text-xs text-gray-body mt-0.5">Fields marked with * are required to continue.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="quiz-title-input" className="text-ink font-semibold text-xs">Quiz Title *</Label>
                    <Input
                      id="quiz-title-input"
                      value={formData.title}
                      onChange={e => {
                        setFormData({ ...formData, title: e.target.value });
                        if (stepErrors.title) setStepErrors(prev => ({ ...prev, title: '' }));
                      }}
                      placeholder="e.g. Midterm Examination: Data Structures"
                      aria-invalid={Boolean(stepErrors.title)}
                      className={`bg-white dark:bg-[#18181B] text-ink text-sm focus:border-maroon focus:ring-1 focus:ring-maroon ${stepErrors.title ? 'border-red-500 ring-1 ring-red-500' : 'border-border-soft'}`}
                    />
                    {stepErrors.title && <p className="text-xs text-red-600 font-medium">{stepErrors.title}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="quiz-subject-input" className="text-ink font-semibold text-xs">Subject / Course *</Label>
                    <Input
                      id="quiz-subject-input"
                      value={formData.subject || facultySubject}
                      readOnly
                      placeholder="e.g. Computer Science & Engineering"
                      aria-invalid={Boolean(stepErrors.subject)}
                      className={`bg-cream/40 dark:bg-[#18181B] text-ink text-sm cursor-not-allowed font-medium opacity-90 ${stepErrors.subject ? 'border-red-500 ring-1 ring-red-500' : 'border-border-soft'}`}
                    />
                    {stepErrors.subject && <p className="text-xs text-red-600 font-medium">{stepErrors.subject}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="quiz-duration-input" className="text-ink font-semibold text-xs">Duration (mins) *</Label>
                    <Input
                      id="quiz-duration-input"
                      value={formData.durationMinutes}
                      onChange={e => {
                        setFormData({ ...formData, durationMinutes: e.target.value });
                        if (stepErrors.durationMinutes) setStepErrors(prev => ({ ...prev, durationMinutes: '' }));
                      }}
                      type="number"
                      min={1}
                      placeholder="60"
                      aria-invalid={Boolean(stepErrors.durationMinutes)}
                      className={`bg-white dark:bg-[#18181B] text-ink text-sm focus:border-maroon focus:ring-1 focus:ring-maroon ${stepErrors.durationMinutes ? 'border-red-500 ring-1 ring-red-500' : 'border-border-soft'}`}
                    />
                    {stepErrors.durationMinutes && <p className="text-xs text-red-600 font-medium">{stepErrors.durationMinutes}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Quiz Schedule */}
            {wizardStep === 2 && (
              <div className="bg-cream/20 dark:bg-[#242429] p-5 rounded-xl border border-border-soft space-y-4">
                <div>
                  <h3 className="text-base font-serif font-bold text-ink">Quiz Schedule</h3>
                  <p className="text-xs text-gray-body mt-0.5">Optionally restrict when students can access this quiz. Leave blank for flexible availability.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="quiz-start-date" className="text-ink font-semibold text-xs">Start Time</Label>
                    <Input
                      id="quiz-start-date"
                      value={formData.startDate}
                      onChange={e => {
                        setFormData({ ...formData, startDate: e.target.value });
                        if (stepErrors.startDate || stepErrors.endDate) setStepErrors(prev => ({ ...prev, startDate: '', endDate: '' }));
                      }}
                      type="datetime-local"
                      aria-invalid={Boolean(stepErrors.startDate)}
                      className={`bg-white dark:bg-[#18181B] text-ink text-xs focus:border-maroon focus:ring-1 focus:ring-maroon ${stepErrors.startDate ? 'border-red-500 ring-1 ring-red-500' : 'border-border-soft'}`}
                    />
                    {stepErrors.startDate && <p className="text-xs text-red-600 font-medium">{stepErrors.startDate}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="quiz-end-date" className="text-ink font-semibold text-xs">End Time</Label>
                    <Input
                      id="quiz-end-date"
                      value={formData.endDate}
                      onChange={e => {
                        setFormData({ ...formData, endDate: e.target.value });
                        if (stepErrors.endDate) setStepErrors(prev => ({ ...prev, endDate: '' }));
                      }}
                      type="datetime-local"
                      aria-invalid={Boolean(stepErrors.endDate)}
                      className={`bg-white dark:bg-[#18181B] text-ink text-xs focus:border-maroon focus:ring-1 focus:ring-maroon ${stepErrors.endDate ? 'border-red-500 ring-1 ring-red-500' : 'border-border-soft'}`}
                    />
                    {stepErrors.endDate && <p className="text-xs text-red-600 font-medium">{stepErrors.endDate}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Marks Configuration */}
            {wizardStep === 3 && (
              <div className="bg-cream/20 dark:bg-[#242429] p-5 rounded-xl border border-border-soft space-y-4">
                <div>
                  <h3 className="text-base font-serif font-bold text-ink">Marks Configuration</h3>
                  <p className="text-xs text-gray-body mt-0.5">Specify total and passing marks. Total marks can be left blank to calculate automatically from questions.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="quiz-total-marks" className="text-ink font-semibold text-xs">Total Marks (Optional)</Label>
                    <Input
                      id="quiz-total-marks"
                      value={formData.totalMarks}
                      onChange={e => {
                        setFormData({ ...formData, totalMarks: e.target.value });
                        if (stepErrors.totalMarks || stepErrors.passingMarks) setStepErrors(prev => ({ ...prev, totalMarks: '', passingMarks: '' }));
                      }}
                      type="number"
                      min={1}
                      placeholder="Calculated automatically if empty"
                      aria-invalid={Boolean(stepErrors.totalMarks)}
                      className={`bg-white dark:bg-[#18181B] text-ink text-xs focus:border-maroon focus:ring-1 focus:ring-maroon ${stepErrors.totalMarks ? 'border-red-500 ring-1 ring-red-500' : 'border-border-soft'}`}
                    />
                    {stepErrors.totalMarks && <p className="text-xs text-red-600 font-medium">{stepErrors.totalMarks}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="quiz-passing-marks" className="text-ink font-semibold text-xs">Passing Marks</Label>
                    <Input
                      id="quiz-passing-marks"
                      value={formData.passingMarks}
                      onChange={e => {
                        setFormData({ ...formData, passingMarks: e.target.value });
                        if (stepErrors.passingMarks) setStepErrors(prev => ({ ...prev, passingMarks: '' }));
                      }}
                      type="number"
                      min={0}
                      placeholder="e.g. 40"
                      aria-invalid={Boolean(stepErrors.passingMarks)}
                      className={`bg-white dark:bg-[#18181B] text-ink text-xs focus:border-maroon focus:ring-1 focus:ring-maroon ${stepErrors.passingMarks ? 'border-red-500 ring-1 ring-red-500' : 'border-border-soft'}`}
                    />
                    {stepErrors.passingMarks && <p className="text-xs text-red-600 font-medium">{stepErrors.passingMarks}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Hierarchical Target Audience Selector: Batch -> Department -> Section */}
            {wizardStep === 4 && (
            <div className="p-4 bg-cream/30 dark:bg-[#242429] rounded-xl border border-border-soft space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-ink font-semibold text-xs block">Assign to:</Label>
                  <p className="text-[11px] text-gray-body mt-0.5">Select a Batch, then Department, then Section to add the target class.</p>
                </div>
                {(formData.targetDepartments.length > 0 || formData.targetSections.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, targetDepartments: [], targetSections: [] }));
                      setSelectedBatchId('');
                      setSelectedDepartmentId('');
                      setSelectedSectionId('');
                    }}
                    className="text-[11px] text-red-500 hover:text-red-700 font-semibold"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                {/* 1. Batch Selector */}
                <div className="space-y-1">
                  <Label htmlFor="target-batch-select" className="text-ink font-semibold text-[11px] block">1. Batch</Label>
                  <select
                    id="target-batch-select"
                    value={selectedBatchId}
                    onChange={e => {
                      setSelectedBatchId(e.target.value);
                      setSelectedDepartmentId('');
                      setSelectedSectionId('');
                    }}
                    className="w-full bg-white dark:bg-[#18181B] border border-border-soft rounded-lg px-3 py-2 text-ink h-10 focus:border-maroon focus:ring-1 focus:ring-maroon outline-none text-xs"
                  >
                    <option value="">Select Batch...</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Department Selector */}
                <div className="space-y-1">
                  <Label htmlFor="target-dept-select" className="text-ink font-semibold text-[11px] block">2. Department</Label>
                  <select
                    id="target-dept-select"
                    value={selectedDepartmentId}
                    disabled={!selectedBatchId}
                    onChange={e => {
                      setSelectedDepartmentId(e.target.value);
                      setSelectedSectionId('');
                    }}
                    className="w-full bg-white dark:bg-[#18181B] border border-border-soft rounded-lg px-3 py-2 text-ink h-10 focus:border-maroon focus:ring-1 focus:ring-maroon outline-none text-xs disabled:opacity-50"
                  >
                    <option value="">{!selectedBatchId ? 'Select Batch first' : 'Select Department...'}</option>
                    {departments
                      .filter(d => d.batchId === selectedBatchId)
                      .map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                  </select>
                </div>

                {/* 3. Section Selector */}
                <div className="space-y-1">
                  <Label htmlFor="target-sec-select" className="text-ink font-semibold text-[11px] block">3. Section</Label>
                  <select
                    id="target-sec-select"
                    value={selectedSectionId}
                    disabled={!selectedDepartmentId}
                    onChange={e => {
                      const secId = e.target.value;
                      setSelectedSectionId(secId);
                      if (secId && selectedDepartmentId) {
                        // Automatically add when section is picked
                        setFormData(prev => ({
                          ...prev,
                          targetDepartments: prev.targetDepartments.includes(selectedDepartmentId)
                            ? prev.targetDepartments
                            : [...prev.targetDepartments, selectedDepartmentId],
                          targetSections: prev.targetSections.includes(secId)
                            ? prev.targetSections
                            : [...prev.targetSections, secId]
                        }));
                        setSelectedSectionId('');
                      }
                    }}
                    className="w-full bg-white dark:bg-[#18181B] border border-border-soft rounded-lg px-3 py-2 text-ink h-10 focus:border-maroon focus:ring-1 focus:ring-maroon outline-none text-xs disabled:opacity-50"
                  >
                    <option value="">{!selectedDepartmentId ? 'Select Dept first' : 'Select Section to Add...'}</option>
                    {(departments.find(d => d.id === selectedDepartmentId)?.sections || [])
                      .filter((s: any) => !formData.targetSections.includes(s.id))
                      .map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                  </select>
                </div>

                {/* Add Entire Department button (optional if user wants whole dept) */}
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!selectedDepartmentId || (formData.targetDepartments.includes(selectedDepartmentId) && (departments.find(d => d.id === selectedDepartmentId)?.sections || []).every((s: any) => formData.targetSections.includes(s.id)))}
                    onClick={() => {
                      if (!selectedDepartmentId) return;
                      const dept = departments.find(d => d.id === selectedDepartmentId);
                      const deptSecIds = (dept?.sections || []).map((s: any) => s.id);
                      setFormData(prev => ({
                        ...prev,
                        targetDepartments: prev.targetDepartments.includes(selectedDepartmentId)
                          ? prev.targetDepartments
                          : [...prev.targetDepartments, selectedDepartmentId],
                        targetSections: Array.from(new Set([...prev.targetSections, ...deptSecIds]))
                      }));
                    }}
                    className="w-full h-10 border-border-soft hover:bg-cream text-xs font-semibold"
                  >
                    + Add All Sections
                  </Button>
                </div>
              </div>

              {/* Combined Listed Items: "Batch - Department - Section" */}
              <div className="pt-2 border-t border-border-soft/60">
                <div className="text-[11px] font-semibold text-ink mb-2">
                  Selected Target Classes ({formData.targetSections.length}):
                </div>
                {formData.targetSections.length > 0 || formData.targetDepartments.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {/* List each selected section with its Batch - Department - Section */}
                    {formData.targetSections.map(secId => {
                      const dept = departments.find(d => (d.sections || []).some((s: any) => s.id === secId));
                      const section = (dept?.sections || []).find((s: any) => s.id === secId);
                      const batch = batches.find(b => b.id === dept?.batchId);
                      const label = `${batch?.name || 'Batch'} - ${dept?.name || 'Dept'} - ${section?.name || secId}`;
                      return (
                        <span
                          key={secId}
                          className="inline-flex items-center gap-2 bg-white dark:bg-[#18181B] border border-border-soft text-ink px-3 py-1.5 rounded-full text-xs font-semibold shadow-xs"
                        >
                          <span>{label}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setFormData(prev => {
                                const remainingSections = prev.targetSections.filter(id => id !== secId);
                                // Check if the department still has any other selected sections
                                const deptSecIds = (dept?.sections || []).map((s: any) => s.id);
                                const hasOtherSecInDept = remainingSections.some(id => deptSecIds.includes(id));
                                return {
                                  ...prev,
                                  targetSections: remainingSections,
                                  targetDepartments: dept && !hasOtherSecInDept
                                    ? prev.targetDepartments.filter(id => id !== dept.id)
                                    : prev.targetDepartments
                                };
                              });
                            }}
                            className="text-gray-body hover:text-red-600 font-bold text-xs focus:outline-none"
                            title="Remove target class"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}

                    {/* Fallback if a department was selected without specific sections (e.g. legacy or edited quiz) */}
                    {formData.targetDepartments
                      .filter(deptId => {
                        const dept = departments.find(d => d.id === deptId);
                        const deptSecIds = (dept?.sections || []).map((s: any) => s.id);
                        return !deptSecIds.some((id: string) => formData.targetSections.includes(id));
                      })
                      .map(deptId => {
                        const dept = departments.find(d => d.id === deptId);
                        const batch = batches.find(b => b.id === dept?.batchId);
                        const label = `${batch?.name || 'Batch'} - ${dept?.name || deptId} - All Sections`;
                        return (
                          <span
                            key={`dept-only-${deptId}`}
                            className="inline-flex items-center gap-2 bg-white dark:bg-[#18181B] border border-border-soft text-ink px-3 py-1.5 rounded-full text-xs font-semibold shadow-xs"
                          >
                            <span>{label}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  targetDepartments: prev.targetDepartments.filter(id => id !== deptId)
                                }));
                              }}
                              className="text-gray-body hover:text-red-600 font-bold text-xs focus:outline-none"
                              title="Remove target department"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-body italic">
                    No target classes added yet. Select Batch → Department → Section above to add.
                  </p>
                )}
              </div>
            </div>
            )}

            {/* Step 5: Add Questions */}
            {wizardStep === 5 && (
            <div className="space-y-5">
              {/* Configured Quiz Summary Strip */}
              <div className="bg-cream/30 dark:bg-[#242429] border border-border-soft rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-body block">Quiz & Subject</span>
                  <span className="font-semibold text-ink block truncate">{formData.title || 'Untitled Quiz'}</span>
                  <span className="text-[11px] text-maroon truncate block">{formData.subject || facultySubject || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-body block">Duration & Marks</span>
                  <span className="font-semibold text-ink block">{formData.durationMinutes || 60} mins</span>
                  <span className="text-[11px] text-gray-body block">
                    {formData.totalMarks ? `${formData.totalMarks} total` : 'Auto total'}
                    {formData.passingMarks ? ` · Pass ${formData.passingMarks}` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-body block">Schedule</span>
                  <span className="font-semibold text-ink block">{formData.startDate ? 'Scheduled Window' : 'Flexible Window'}</span>
                  <button type="button" onClick={() => handleJumpToWizardStep(2)} className="text-[11px] text-maroon underline font-semibold">Edit schedule</button>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-body block">Target Classes</span>
                  <span className="font-semibold text-ink block">
                    {(formData.targetSections.length || formData.targetDepartments.length) > 0
                      ? `${formData.targetSections.length || formData.targetDepartments.length} selected`
                      : 'None added'}
                  </span>
                  <button type="button" onClick={() => handleJumpToWizardStep(4)} className="text-[11px] text-maroon underline font-semibold">Edit classes</button>
                </div>
              </div>

              {activeQuizId && (
                <div className="flex flex-wrap justify-between items-center gap-3 bg-cream/20 dark:bg-[#242429] border border-border-soft rounded-xl p-4">
                  <span className="text-xs text-gray-body font-medium">Review existing questions or save metadata & class updates directly.</span>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveView('add_questions')}
                      className="border-border-soft hover:bg-cream/40 font-semibold rounded-full px-6"
                    >
                      Review & Edit Questions ({questions.length})
                    </Button>
                    <Button onClick={() => handleSaveQuizAndQuestions(true)} disabled={loading} className="bg-maroon hover:bg-maroon-deep text-white font-bold rounded-full px-7">
                      {loading ? 'Saving...' : 'Save Quiz Changes'}
                    </Button>
                  </div>
                </div>
              )}

            {/* Question Creation Options Tabs */}
            <div className="border-t border-border-soft pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <Label className="text-ink font-serif font-bold text-lg">Add Questions Method</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowTemplateModal(true)} className="border-border-soft hover:bg-cream/40 text-xs font-semibold">
                    Download DOCX Template
                  </Button>
                  <div className="flex gap-2 bg-cream/40 p-1 rounded-full border border-border-soft">
                  <button
                    type="button"
                    onClick={() => setCreationMode('paste')}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${creationMode === 'paste' ? 'bg-maroon text-white shadow-sm' : 'text-gray-body hover:text-ink'}`}
                  >
                    📝 Paste Textboxes (Bulk)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreationMode('docx')}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${creationMode === 'docx' ? 'bg-maroon text-white shadow-sm' : 'text-gray-body hover:text-ink'}`}
                  >
                    📄 Upload DOCX
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreationMode('manual')}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${creationMode === 'manual' ? 'bg-maroon text-white shadow-sm' : 'text-gray-body hover:text-ink'}`}
                  >
                    ✏️ Manual Builder
                  </button>
                  </div>
                </div>
              </div>

              {/* Mode 1: Paste Textboxes */}
              {creationMode === 'paste' && (
                <div className="p-5 bg-cream/30 dark:bg-[#242429] rounded-xl border border-border-soft space-y-5">
                  <div>
                    <h3 className="text-sm font-bold text-ink mb-1 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-maroon" /> Select Question Types to Paste
                    </h3>
                    <p className="text-xs text-gray-body">
                      Check the question formats you want to add. Textboxes will open below for each type.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 p-3 bg-white dark:bg-[#1E1E22] rounded-lg border border-border-soft">
                    {(['MCQ', 'SHORT_WRITTEN', 'NUMERICAL', 'LONG_WRITTEN', 'MATCHING', 'FILL_BLANK'] as const).map(type => {
                      const labelMap = {
                        MCQ: 'MCQ (Single/Multi)',
                        SHORT_WRITTEN: 'Short Written',
                        NUMERICAL: 'Numerical',
                        LONG_WRITTEN: 'Long Written',
                        MATCHING: 'Match Following',
                        FILL_BLANK: 'Fill in Blanks',
                      };
                      return (
                        <label key={type} className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-cream/40 select-none">
                          <input
                            type="checkbox"
                            checked={bulkConfig[type]?.selected || false}
                            onChange={(e) => setBulkConfig({
                              ...bulkConfig,
                              [type]: { ...(bulkConfig[type] || { text: '' }), selected: e.target.checked }
                            })}
                            className="w-4 h-4 rounded text-maroon focus:ring-maroon accent-maroon"
                          />
                          <span className="text-xs font-semibold text-ink">{labelMap[type]}</span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Dynamic Textareas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {bulkConfig.MCQ.selected && (
                      <div className="space-y-2 bg-white dark:bg-[#1E1E22] p-4 rounded-xl border border-border-soft shadow-sm">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs text-maroon font-bold flex items-center gap-1">
                            <Clipboard className="w-3.5 h-3.5" /> MCQ Questions Box
                          </Label>
                          <span className="text-[10px] text-gray-body bg-cream/60 px-2 py-0.5 rounded border border-border-soft font-mono">{"Format: Question -> Options A-D -> Answer: X"}</span>
                        </div>
                        <Textarea
                          placeholder={`1. What is the complexity of binary search?\nA) O(1)\nB) O(log n)\nC) O(n)\nD) O(n^2)\nAnswer: B\n\n2. Which layer is HTTP protocol located?\nA) Transport\nB) Network\nC) Application\nD) Data Link\nAnswer: C`}
                          value={bulkConfig.MCQ.text}
                          onChange={(e) => setBulkConfig({
                            ...bulkConfig,
                            MCQ: { ...bulkConfig.MCQ, text: e.target.value }
                          })}
                          className="h-52 bg-cream/10 dark:bg-[#18181B] border-border-soft font-mono text-xs text-ink focus:border-maroon focus:ring-1 focus:ring-maroon"
                        />
                      </div>
                    )}

                    {bulkConfig.SHORT_WRITTEN.selected && (
                      <div className="space-y-2 bg-white dark:bg-[#1E1E22] p-4 rounded-xl border border-border-soft shadow-sm">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs text-maroon font-bold flex items-center gap-1">
                            <Clipboard className="w-3.5 h-3.5" /> Short Written Questions Box
                          </Label>
                          <span className="text-[10px] text-gray-body bg-cream/60 px-2 py-0.5 rounded border border-border-soft font-mono">{"Format: Question -> Answer: ..."}</span>
                        </div>
                        <Textarea
                          placeholder={`1. Explain CPU Cache memory.\nAnswer: Cache is high-speed volatile memory placed close to CPU for fast data access.\n\n2. Define Polymorphism in Object-Oriented Programming.\nAnswer: Polymorphism allows methods to behave differently based on the object calling them.`}
                          value={bulkConfig.SHORT_WRITTEN.text}
                          onChange={(e) => setBulkConfig({
                            ...bulkConfig,
                            SHORT_WRITTEN: { ...bulkConfig.SHORT_WRITTEN, text: e.target.value }
                          })}
                          className="h-52 bg-cream/10 dark:bg-[#18181B] border-border-soft font-mono text-xs text-ink focus:border-maroon focus:ring-1 focus:ring-maroon"
                        />
                      </div>
                    )}

                    {bulkConfig.NUMERICAL.selected && (
                      <div className="space-y-2 bg-white dark:bg-[#1E1E22] p-4 rounded-xl border border-border-soft shadow-sm">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs text-maroon font-bold flex items-center gap-1">
                            <Clipboard className="w-3.5 h-3.5" /> Numerical Questions Box
                          </Label>
                          <span className="text-[10px] text-gray-body bg-cream/60 px-2 py-0.5 rounded border border-border-soft font-mono">{"Format: Question -> Answer: 10"}</span>
                        </div>
                        <Textarea
                          placeholder={`1. What is 2^8?\nAnswer: 256\n\n2. Solve: 15 * 14\nAnswer: 210`}
                          value={bulkConfig.NUMERICAL.text}
                          onChange={(e) => setBulkConfig({
                            ...bulkConfig,
                            NUMERICAL: { ...bulkConfig.NUMERICAL, text: e.target.value }
                          })}
                          className="h-52 bg-cream/10 dark:bg-[#18181B] border-border-soft font-mono text-xs text-ink focus:border-maroon focus:ring-1 focus:ring-maroon"
                        />
                      </div>
                    )}

                    {bulkConfig.LONG_WRITTEN.selected && (
                      <div className="space-y-2 bg-white dark:bg-[#1E1E22] p-4 rounded-xl border border-border-soft shadow-sm">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs text-maroon font-bold flex items-center gap-1">
                            <Clipboard className="w-3.5 h-3.5" /> Long Written Questions Box
                          </Label>
                          <span className="text-[10px] text-gray-body bg-cream/60 px-2 py-0.5 rounded border border-border-soft font-mono">{"Format: Question -> Answer: key points"}</span>
                        </div>
                        <Textarea
                          placeholder={`1. Describe the Database ACID properties in detail.\nAnswer: Atomicity ensures all-or-nothing transactions; Consistency maintains DB rules; Isolation prevents concurrency issues; Durability guarantees persistence.\n\n2. Explain Dijkstra's shortest path algorithm.\nAnswer: Greedy algorithm using min-priority queue to find shortest path from single source.`}
                          value={bulkConfig.LONG_WRITTEN.text}
                          onChange={(e) => setBulkConfig({
                            ...bulkConfig,
                            LONG_WRITTEN: { ...bulkConfig.LONG_WRITTEN, text: e.target.value }
                          })}
                          className="h-52 bg-cream/10 dark:bg-[#18181B] border-border-soft font-mono text-xs text-ink focus:border-maroon focus:ring-1 focus:ring-maroon"
                        />
                      </div>
                    )}

                    {bulkConfig.MATCHING?.selected && (
                      <div className="space-y-2 bg-white dark:bg-[#1E1E22] p-4 rounded-xl border border-border-soft shadow-sm">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs text-maroon font-bold flex items-center gap-1">
                            <Clipboard className="w-3.5 h-3.5" /> Match the Following Box
                          </Label>
                          <span className="text-[10px] text-gray-body bg-cream/60 px-2 py-0.5 rounded border border-border-soft font-mono">{"Format: Term -> Match"}</span>
                        </div>
                        <Textarea
                          placeholder={`1. Match the data structures with their complexities:\nBinary Search -> O(log n)\nLinear Search -> O(n)\nHash Table Lookup -> O(1)\nMerge Sort -> O(n log n)\n\n2. Match countries to capitals:\nFrance -> Paris\nJapan -> Tokyo`}
                          value={bulkConfig.MATCHING.text}
                          onChange={(e) => setBulkConfig({
                            ...bulkConfig,
                            MATCHING: { ...bulkConfig.MATCHING, text: e.target.value }
                          })}
                          className="h-52 bg-cream/10 dark:bg-[#18181B] border-border-soft font-mono text-xs text-ink focus:border-maroon focus:ring-1 focus:ring-maroon"
                        />
                      </div>
                    )}

                    {bulkConfig.FILL_BLANK?.selected && (
                      <div className="space-y-2 bg-white dark:bg-[#1E1E22] p-4 rounded-xl border border-border-soft shadow-sm">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs text-maroon font-bold flex items-center gap-1">
                            <Clipboard className="w-3.5 h-3.5" /> Fill in the Blanks Box
                          </Label>
                          <span className="text-[10px] text-gray-body bg-cream/60 px-2 py-0.5 rounded border border-border-soft font-mono">{"Format: Question with [blank] -> Answer: ..."}</span>
                        </div>
                        <Textarea
                          placeholder={`1. The time complexity of binary search is [blank].\nAnswer: O(log n), log n\n\n2. The capital of France is [blank].\nAnswer: Paris`}
                          value={bulkConfig.FILL_BLANK.text}
                          onChange={(e) => setBulkConfig({
                            ...bulkConfig,
                            FILL_BLANK: { ...bulkConfig.FILL_BLANK, text: e.target.value }
                          })}
                          className="h-52 bg-cream/10 dark:bg-[#18181B] border-border-soft font-mono text-xs text-ink focus:border-maroon focus:ring-1 focus:ring-maroon"
                        />
                      </div>
                    )}
                  </div>

                  {!Object.values(bulkConfig).some(c => c.selected) && (
                    <div className="text-center py-6 bg-white dark:bg-[#1E1E22] rounded-xl border border-dashed border-border-soft text-gray-body text-xs flex items-center justify-center gap-2">
                      <AlertCircle className="w-4 h-4 text-maroon" /> Check at least one question type checkbox above to reveal pasting textboxes.
                    </div>
                  )}

                  <div className="flex justify-end pt-3">
                    <Button
                      type="button"
                      onClick={handleImportBulkQuestions}
                      disabled={!Object.values(bulkConfig).some(c => c.selected && c.text.trim().length > 0)}
                      className="bg-maroon hover:bg-maroon-deep text-white font-bold h-11 px-8 rounded-full transition-all shadow-sm flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" /> Convert into Questions & Review
                    </Button>
                  </div>
                </div>
              )}

              {/* Mode 2: Upload DOCX */}
              {creationMode === 'docx' && (
                <div className="p-8 bg-yellow-50/50 dark:bg-yellow-950/30 rounded-xl border border-yellow-200 dark:border-yellow-900/50 text-center space-y-4">
                  <h3 className="font-serif font-bold text-lg text-yellow-900 dark:text-yellow-200">Upload Pre-formatted Word (.docx) Document</h3>
                  <p className="text-xs text-yellow-800 dark:text-yellow-300 max-w-md mx-auto leading-relaxed">
                    Quiz metadata, title, instructions, questions, options, and answer keys will be extracted automatically from your document.
                  </p>
                  <label className="cursor-pointer px-8 py-3.5 bg-maroon hover:bg-maroon-deep text-white rounded-full font-bold transition-all shadow-sm inline-block text-sm">
                    {loading ? 'Parsing DOCX Document...' : 'Select .docx File & Convert'}
                    <input type="file" accept=".docx" className="hidden" onChange={handleUploadDocxForCreation} disabled={loading} />
                  </label>
                </div>
              )}

              {/* Mode 3: Manual Builder */}
              {creationMode === 'manual' && (
                <div className="p-8 bg-cream/30 dark:bg-[#242429] rounded-xl border border-border-soft text-center space-y-4">
                  <h3 className="font-serif font-bold text-lg text-ink">Manual Question Builder</h3>
                  <p className="text-xs text-gray-body max-w-md mx-auto">
                    Start with an empty questions workspace and build questions one by one.
                  </p>
                  <Button
                    type="button"
                    onClick={() => setActiveView('add_questions')}
                    className="bg-maroon hover:bg-maroon-deep text-white font-bold h-11 px-8 rounded-full transition-all shadow-sm"
                  >
                    Open Question Builder Workspace
                  </Button>
                </div>
              )}
            </div>
            </div>
            )}

            {/* Step Wizard Footer Navigation */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-soft pt-5">
              <div>
                {wizardStep > 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrevWizardStep}
                    className="border-border-soft hover:bg-cream/40 font-semibold text-xs px-5 rounded-full inline-flex items-center gap-1.5"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back
                  </Button>
                ) : (
                  <span className="text-xs text-gray-body">Step {wizardStep} of 5</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {wizardStep < 5 ? (
                  <Button
                    type="button"
                    onClick={handleNextWizardStep}
                    className="bg-maroon hover:bg-maroon-deep text-white font-bold text-xs px-7 h-10 rounded-full inline-flex items-center gap-1.5 shadow-sm"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : !activeQuizId && hasStagedQuestions ? (
                  <Button
                    type="button"
                    onClick={() => handleSaveQuizAndQuestions(false)}
                    disabled={loading}
                    className="bg-maroon hover:bg-maroon-deep text-white font-bold text-xs px-7 h-10 rounded-full shadow-sm"
                  >
                    {loading ? 'Scheduling...' : 'Create Quiz'}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmationDialog
        open={showDiscardConfirm}
        title="Discard unsaved quiz?"
        description="You have unsaved changes in this quiz wizard. Returning to Quiz Management will discard your progress."
        confirmLabel="Discard Changes"
        onCancel={() => setShowDiscardConfirm(false)}
        onConfirm={handleDiscardWizardChanges}
      />

      {/* Template Configuration Modal */}
      {showTemplateModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/15 dark:bg-black/55 backdrop-blur-[2px]">
          <div className="bg-white dark:bg-[#1E1E22] border border-border-soft rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-serif font-bold text-ink mb-4">Template Configuration</h2>
            
            <div className="space-y-6">
              <div>
                <Label className="text-xs font-semibold text-ink">Total Number of Questions</Label>
                <Input
                  type="number"
                  min={1}
                  value={templateConfig.totalQuestions}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setTemplateConfig(prev => ({ ...prev, totalQuestions: val, mcqCount: prev.isMixedTypes ? prev.mcqCount : val }));
                  }}
                  className="mt-1 bg-white dark:bg-[#18181B] border-border-soft text-ink"
                />
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="mixed-types" 
                  checked={templateConfig.isMixedTypes}
                  onChange={(e) => setTemplateConfig(prev => ({ 
                    ...prev, 
                    isMixedTypes: e.target.checked,
                    mcqCount: e.target.checked ? 0 : prev.totalQuestions,
                    numericalCount: 0,
                    shortCount: 0,
                    longCount: 0,
                    matchingCount: 0,
                    fillBlankCount: 0
                  }))}
                  className="rounded text-maroon focus:ring-maroon accent-maroon"
                />
                <Label htmlFor="mixed-types" className="text-xs font-semibold text-ink">Mixed Question Types</Label>
              </div>

              {templateConfig.isMixedTypes && (
                <div className="space-y-4 p-4 bg-cream/30 dark:bg-[#242429] rounded-lg border border-border-soft">
                  <div className="grid grid-cols-2 gap-4 items-center">
                    <Label className="text-xs font-medium text-ink">Multiple Choice (MCQ)</Label>
                    <Input type="number" min={0} value={templateConfig.mcqCount} onChange={e => setTemplateConfig(p => ({ ...p, mcqCount: parseInt(e.target.value) || 0 }))} className="bg-white dark:bg-[#18181B] border-border-soft text-ink" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 items-center">
                    <Label className="text-xs font-medium text-ink">Numerical</Label>
                    <Input type="number" min={0} value={templateConfig.numericalCount} onChange={e => setTemplateConfig(p => ({ ...p, numericalCount: parseInt(e.target.value) || 0 }))} className="bg-white dark:bg-[#18181B] border-border-soft text-ink" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 items-center">
                    <Label className="text-xs font-medium text-ink">Short Answer</Label>
                    <Input type="number" min={0} value={templateConfig.shortCount} onChange={e => setTemplateConfig(p => ({ ...p, shortCount: parseInt(e.target.value) || 0 }))} className="bg-white dark:bg-[#18181B] border-border-soft text-ink" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 items-center">
                    <Label className="text-xs font-medium text-ink">Long Answer</Label>
                    <Input type="number" min={0} value={templateConfig.longCount} onChange={e => setTemplateConfig(p => ({ ...p, longCount: parseInt(e.target.value) || 0 }))} className="bg-white dark:bg-[#18181B] border-border-soft text-ink" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 items-center">
                    <Label className="text-xs font-medium text-ink">Match the Following</Label>
                    <Input type="number" min={0} value={templateConfig.matchingCount} onChange={e => setTemplateConfig(p => ({ ...p, matchingCount: parseInt(e.target.value) || 0 }))} className="bg-white dark:bg-[#18181B] border-border-soft text-ink" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 items-center">
                    <Label className="text-xs font-medium text-ink">Fill in the Blanks</Label>
                    <Input type="number" min={0} value={templateConfig.fillBlankCount} onChange={e => setTemplateConfig(p => ({ ...p, fillBlankCount: parseInt(e.target.value) || 0 }))} className="bg-white dark:bg-[#18181B] border-border-soft text-ink" />
                  </div>
                  
                  {(() => {
                    const sum = templateConfig.mcqCount + templateConfig.numericalCount + templateConfig.shortCount + templateConfig.longCount + templateConfig.matchingCount + templateConfig.fillBlankCount;
                    return (
                      <div className={`text-xs font-bold ${sum !== templateConfig.totalQuestions ? 'text-red-500' : 'text-green-700 dark:text-green-400'}`}>
                        Sum: {sum} / {templateConfig.totalQuestions}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <Button variant="ghost" onClick={() => setShowTemplateModal(false)} className="text-xs font-semibold">Cancel</Button>
              <Button 
                onClick={downloadTemplate}
                disabled={templateConfig.isMixedTypes && (templateConfig.mcqCount + templateConfig.numericalCount + templateConfig.shortCount + templateConfig.longCount + templateConfig.matchingCount + templateConfig.fillBlankCount) !== templateConfig.totalQuestions}
                className="bg-maroon hover:bg-maroon-deep text-white font-bold text-xs rounded-full px-6"
              >
                Generate Template
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
      </>
    );
  }

  if (activeView === 'add_questions') {
    const sumMarks = questions.reduce((acc, q) => acc + (Number(q.marks) || 0), 0);
    const expectedMarks = Number(formData.totalMarks) || 0;
    const isMismatch = expectedMarks > 0 && sumMarks !== expectedMarks;

    return (
      <Card className="bg-white dark:bg-[#1E1E22] border border-border-soft text-ink shadow-sm rounded-xl">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-border-soft">
            <div>
              <h2 className="text-2xl font-serif font-bold text-ink">{formData.title || 'Review & Finalize Quiz Questions'}</h2>
              <p className="text-gray-body text-xs mt-0.5">{formData.subject || 'Subject'} | {formData.durationMinutes || 60} mins | {questions.length} Questions ({sumMarks} Total Marks)</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setWizardStep(5);
                  setActiveView('create');
                }}
                className="border-border-soft hover:bg-cream/40 text-ink font-semibold text-xs flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back to Step 5
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={() => setShowBulkImport(!showBulkImport)}
                className="border-border-soft hover:bg-cream/40 text-maroon font-semibold text-xs flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-maroon" />
                {showBulkImport ? 'Hide Quick Paste' : 'Quick Paste More Questions'}
              </Button>
              <button onClick={() => setActiveView('list')} className="text-maroon hover:text-maroon-deep font-semibold text-xs">Cancel</button>
            </div>
          </div>

          {/* Inline Quick Paste panel inside add_questions view */}
          {showBulkImport && (
            <div className="mb-6 p-5 bg-cream/30 dark:bg-[#242429] rounded-xl border border-border-soft space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-ink flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-maroon" /> Quick Paste Additional Questions
                </h3>
                <span className="text-[10px] text-gray-body">Select question types below and paste text to append to this quiz.</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 p-2 bg-white dark:bg-[#1E1E22] rounded-lg border border-border-soft">
                {(['MCQ', 'SHORT_WRITTEN', 'NUMERICAL', 'LONG_WRITTEN', 'MATCHING', 'FILL_BLANK'] as const).map(type => (
                  <label key={type} className="flex items-center space-x-2 cursor-pointer p-1.5 rounded hover:bg-cream/40 select-none">
                    <input
                      type="checkbox"
                      checked={bulkConfig[type]?.selected || false}
                      onChange={(e) => setBulkConfig({
                        ...bulkConfig,
                        [type]: { ...(bulkConfig[type] || { text: '' }), selected: e.target.checked }
                      })}
                      className="w-3.5 h-3.5 rounded text-maroon focus:ring-maroon accent-maroon"
                    />
                    <span className="text-xs font-semibold text-ink">{type}</span>
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bulkConfig.MCQ.selected && (
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-maroon">MCQ Textbox</Label>
                    <Textarea value={bulkConfig.MCQ.text} onChange={e => setBulkConfig({...bulkConfig, MCQ: {...bulkConfig.MCQ, text: e.target.value}})} placeholder="1. Question...\nA) Opt 1\nB) Opt 2\nAnswer: A" className="h-36 font-mono text-xs bg-white dark:bg-[#18181B] text-ink" />
                  </div>
                )}
                {bulkConfig.SHORT_WRITTEN.selected && (
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-maroon">Short Written Textbox</Label>
                    <Textarea value={bulkConfig.SHORT_WRITTEN.text} onChange={e => setBulkConfig({...bulkConfig, SHORT_WRITTEN: {...bulkConfig.SHORT_WRITTEN, text: e.target.value}})} placeholder="1. Question...\nAnswer: key answer" className="h-36 font-mono text-xs bg-white dark:bg-[#18181B] text-ink" />
                  </div>
                )}
                {bulkConfig.NUMERICAL.selected && (
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-maroon">Numerical Textbox</Label>
                    <Textarea value={bulkConfig.NUMERICAL.text} onChange={e => setBulkConfig({...bulkConfig, NUMERICAL: {...bulkConfig.NUMERICAL, text: e.target.value}})} placeholder="1. Question...\nAnswer: 42" className="h-36 font-mono text-xs bg-white dark:bg-[#18181B] text-ink" />
                  </div>
                )}
                {bulkConfig.LONG_WRITTEN.selected && (
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-maroon">Long Written Textbox</Label>
                    <Textarea value={bulkConfig.LONG_WRITTEN.text} onChange={e => setBulkConfig({...bulkConfig, LONG_WRITTEN: {...bulkConfig.LONG_WRITTEN, text: e.target.value}})} placeholder="1. Question...\nAnswer: detailed points" className="h-36 font-mono text-xs bg-white dark:bg-[#18181B] text-ink" />
                  </div>
                )}
                {bulkConfig.MATCHING?.selected && (
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-maroon">Match the Following Textbox</Label>
                    <Textarea value={bulkConfig.MATCHING.text} onChange={e => setBulkConfig({...bulkConfig, MATCHING: {...bulkConfig.MATCHING, text: e.target.value}})} placeholder="1. Match pairs:\nFrance -> Paris\nJapan -> Tokyo" className="h-36 font-mono text-xs bg-white dark:bg-[#18181B] text-ink" />
                  </div>
                )}
                {bulkConfig.FILL_BLANK?.selected && (
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-maroon">Fill in the Blanks Textbox</Label>
                    <Textarea value={bulkConfig.FILL_BLANK.text} onChange={e => setBulkConfig({...bulkConfig, FILL_BLANK: {...bulkConfig.FILL_BLANK, text: e.target.value}})} placeholder="1. The capital of France is [blank].\nAnswer: Paris" className="h-36 font-mono text-xs bg-white dark:bg-[#18181B] text-ink" />
                  </div>
                )}
              </div>

              {Object.values(bulkConfig).some(c => c.selected && c.text.trim()) && (
                <div className="flex justify-end pt-2">
                  <Button type="button" onClick={handleImportBulkQuestions} className="bg-maroon hover:bg-maroon-deep text-white text-xs font-bold rounded-full px-5 py-2">
                    Append Pasted Questions
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {isMismatch && (
             <div className="mb-6 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50 px-4 py-3 rounded-lg text-sm font-medium shadow-sm">
                 ⚠️ Total Marks Mismatch! The quiz metadata specifies {expectedMarks} marks, but the questions sum up to {sumMarks} marks. Please adjust question marks before publishing.
             </div>
          )}

          <div className="space-y-6">
            {questions.map((q, qIndex) => {
              if (q.type === 'MATCHING' && (!q.options || typeof q.options[0] !== 'object')) {
                q.options = [{ left: '', right: '' }, { left: '', right: '' }];
              }
              return (
                <div key={qIndex} id={`question-${qIndex}`} className={`p-5 bg-cream/30 dark:bg-[#242429] rounded-xl border ${q.validationError ? 'border-red-400 ring-2 ring-red-100 dark:ring-red-950/50' : 'border-border-soft'} space-y-4`}>
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-ink">Question {qIndex + 1}</h3>
                    <div className="flex gap-4">
                      <select value={q.type} onChange={(e) => updateQuestion(qIndex, 'type', e.target.value)} className="bg-white dark:bg-[#18181B] border border-border-soft rounded-lg px-3 py-1 text-xs text-ink focus:border-maroon outline-none font-semibold shadow-sm">
                        <option value="MCQ">MCQ (Single)</option>
                        <option value="MULTI_SELECT">MCQ (Multiple)</option>
                        <option value="NUMERICAL">Numerical</option>
                        <option value="SHORT_WRITTEN">Short Written</option>
                        <option value="LONG_WRITTEN">Long Written</option>
                        <option value="MATCHING">Match the Following</option>
                        <option value="FILL_BLANK">Fill in the Blanks</option>
                      </select>
                      <button onClick={() => { const n = [...questions]; n.splice(qIndex, 1); setQuestions(n); }} className="text-red-500 text-xs font-bold hover:underline">Remove</button>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-xs text-gray-body block mb-1">Question Text</Label>
                    <Textarea value={q.text} onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)} rows={2} className="bg-white dark:bg-[#18181B] border-border-soft text-ink focus:border-maroon focus:ring-1 focus:ring-maroon" />
                  </div>

                  <div>
                    <Label className="text-xs text-maroon block mb-1 font-semibold">Topic *</Label>
                    <Input type="text" value={q.topic || ''} onChange={(e) => updateQuestion(qIndex, 'topic', e.target.value)} placeholder="e.g. Graphs, Inheritance, Kinematics" className="bg-white dark:bg-[#18181B] border-border-soft text-ink focus:border-maroon focus:ring-1 focus:ring-maroon" />
                  </div>

                  {q.validationError && (
                    <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50 px-4 py-2 rounded-lg text-sm mt-2 font-medium">
                      ⚠️ {q.validationError}
                    </div>
                  )}

                  {q.image && (
                    <div className="mt-2">
                      <img src={q.image} alt={`Question ${qIndex + 1}`} className="max-w-md max-h-64 object-contain rounded-xl border border-border-soft" />
                    </div>
                  )}

                  <div className="mt-2">
                    <label className="text-xs text-maroon cursor-pointer hover:text-maroon-deep font-semibold">
                      + {q.image ? 'Change Image' : 'Upload Image'}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        if (e.target.files?.[0]) handleImageUpload(qIndex, e.target.files[0]);
                      }} />
                    </label>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-32">
                      <Label className="text-xs text-gray-body block mb-1">Marks</Label>
                      <Input type="number" min="0" value={q.marks} onChange={(e) => updateQuestion(qIndex, 'marks', e.target.value)} className="bg-white dark:bg-[#18181B] border-border-soft text-ink focus:border-maroon focus:ring-1 focus:ring-maroon" />
                    </div>
                  </div>

                  {/* Answer Key UI based on Type */}
                  {(q.type === 'MCQ' || q.type === 'MULTI_SELECT') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 bg-white/60 dark:bg-[#1E1E22] p-4 border border-border-soft rounded-xl">
                      <div className="col-span-1 md:col-span-2 text-xs font-bold text-gray-body mb-1 flex items-center justify-between">
                        <span>Define Options and Click an Option (or "Set Answer") to Mark as Correct Answer:</span>
                        {q.type === 'MCQ' && !q.answerKey && (
                          <span className="text-red-500 font-semibold text-[11px] animate-pulse">⚠️ Select correct answer</span>
                        )}
                      </div>
                      {q.options.map((opt: string, optIndex: number) => {
                        const isSelected = q.type === 'MCQ'
                          ? q.answerKey === opt && opt !== ''
                          : Array.isArray(q.answerKey) && q.answerKey.includes(opt);
                        return (
                          <div
                            key={optIndex}
                            onClick={() => {
                              if (q.type === 'MCQ') {
                                updateQuestion(qIndex, 'answerKey', opt);
                              }
                            }}
                            className={`flex gap-2 items-center p-2 rounded-lg border transition-all cursor-pointer ${
                              isSelected
                                ? 'border-green-500 bg-green-50/40 dark:bg-green-950/30 ring-1 ring-green-400'
                                : 'border-border-soft bg-white dark:bg-[#18181B] hover:border-maroon/40'
                            }`}
                          >
                            <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full shrink-0 ${
                              isSelected ? 'bg-green-600 text-white' : 'bg-cream text-gray-body border border-border-soft'
                            }`}>
                              {String.fromCharCode(65 + optIndex)}
                            </span>
                            <Input
                              type="text"
                              value={opt}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateOption(qIndex, optIndex, e.target.value)}
                              placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                              className="flex-1 bg-white dark:bg-[#18181B] border-border-soft text-ink focus:border-maroon focus:ring-1 focus:ring-maroon text-xs"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (q.type === 'MCQ') {
                                  updateQuestion(qIndex, 'answerKey', opt);
                                } else {
                                  let curr = Array.isArray(q.answerKey) ? [...q.answerKey] : [];
                                  if (curr.includes(opt)) curr = curr.filter(x => x !== opt);
                                  else curr.push(opt);
                                  updateQuestion(qIndex, 'answerKey', curr);
                                }
                              }}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all shrink-0 ${
                                isSelected
                                  ? 'bg-green-600 text-white shadow-sm'
                                  : 'bg-cream/70 hover:bg-cream text-gray-body hover:text-ink border border-border-soft'
                              }`}
                            >
                              {isSelected ? '✓ Answer' : 'Set Answer'}
                            </button>
                          </div>
                        );
                      })}
                      <button onClick={() => { const n = [...questions]; n[qIndex].options.push(''); setQuestions(n); }} className="col-span-1 md:col-span-2 text-left text-xs text-maroon hover:text-maroon-deep font-semibold mt-1">+ Add Option</button>
                    </div>
                  )}

                  {(q.type === 'SHORT_WRITTEN' || q.type === 'LONG_WRITTEN') && (
                    <div className="mt-2">
                      <Label className="text-xs text-green-700 dark:text-green-400 block mb-1 font-semibold">Expected Answer / Answer Key (For Faculty Reference)</Label>
                      <Textarea value={q.answerKey || ''} onChange={(e) => updateQuestion(qIndex, 'answerKey', e.target.value)} rows={q.type === 'LONG_WRITTEN' ? 4 : 2} placeholder="Provide the expected answer points..." className="bg-white dark:bg-[#18181B] border-green-200 dark:border-green-900/50 focus-visible:ring-green-600 text-ink" />
                    </div>
                  )}

                  {q.type === 'NUMERICAL' && (
                    <div className="mt-2">
                      <Label className="text-xs text-green-700 dark:text-green-400 block mb-1 font-semibold">Exact Numerical Answer</Label>
                      <Input type="number" value={q.answerKey || ''} onChange={(e) => updateQuestion(qIndex, 'answerKey', Number(e.target.value))} placeholder="e.g. 42" className="bg-white dark:bg-[#18181B] border-green-200 dark:border-green-900/50 focus-visible:ring-green-600 text-ink" />
                    </div>
                  )}

                  {q.type === 'MATCHING' && (
                    <div className="mt-2 bg-white/60 dark:bg-[#1E1E22] p-4 border border-border-soft rounded-xl">
                      <div className="flex justify-between items-center mb-3">
                        <div className="text-xs font-bold text-gray-body">
                          Define Matching Pairs (Column A matches Column B). Use ▲/▼ to reorder Column B:
                        </div>
                      </div>
                      <div className="grid grid-cols-12 gap-2 mb-2 text-xs font-bold text-gray-body px-1">
                        <div className="col-span-5">Column A (Questions / Terms)</div>
                        <div className="col-span-1 text-center">→</div>
                        <div className="col-span-5">Column B (Matching Answers)</div>
                        <div className="col-span-1 text-center">Order</div>
                      </div>
                      {q.options.map((pair: any, optIndex: number) => (
                        <div key={optIndex} className="grid grid-cols-12 gap-2 items-center mb-2">
                          <div className="col-span-5 flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-maroon min-w-4 text-center">{optIndex + 1}.</span>
                            <Input 
                              type="text" 
                              value={pair.left || ''} 
                              onChange={(e) => updateMatchingOption(qIndex, optIndex, 'left', e.target.value)} 
                              placeholder={`Term / Question ${optIndex + 1}`} 
                              className="flex-1 bg-white dark:bg-[#18181B] border-border-soft text-ink text-xs focus:border-maroon focus:ring-1 focus:ring-maroon" 
                            />
                          </div>
                          <span className="col-span-1 text-center text-gray-body font-bold">→</span>
                          <div className="col-span-5 flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-maroon min-w-4 text-center">{String.fromCharCode(65 + optIndex)}.</span>
                            <Input 
                              type="text" 
                              value={pair.right || ''} 
                              onChange={(e) => updateMatchingOption(qIndex, optIndex, 'right', e.target.value)} 
                              placeholder={`Answer / Match ${String.fromCharCode(65 + optIndex)}`} 
                              className="flex-1 bg-white dark:bg-[#18181B] border-border-soft text-ink text-xs focus:border-maroon focus:ring-1 focus:ring-maroon" 
                            />
                          </div>
                          <div className="col-span-1 flex items-center justify-center gap-1">
                            <button
                              type="button"
                              disabled={optIndex === 0}
                              onClick={() => {
                                const newQs = [...questions];
                                const pairs = [...newQs[qIndex].options];
                                const temp = pairs[optIndex].right;
                                pairs[optIndex].right = pairs[optIndex - 1].right;
                                pairs[optIndex - 1].right = temp;
                                newQs[qIndex].options = pairs;
                                setQuestions(newQs);
                              }}
                              className="p-1 text-xs hover:text-maroon disabled:opacity-30 disabled:hover:text-inherit"
                              title="Move Column B option up"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              disabled={optIndex === q.options.length - 1}
                              onClick={() => {
                                const newQs = [...questions];
                                const pairs = [...newQs[qIndex].options];
                                const temp = pairs[optIndex].right;
                                pairs[optIndex].right = pairs[optIndex + 1].right;
                                pairs[optIndex + 1].right = temp;
                                newQs[qIndex].options = pairs;
                                setQuestions(newQs);
                              }}
                              className="p-1 text-xs hover:text-maroon disabled:opacity-30 disabled:hover:text-inherit"
                              title="Move Column B option down"
                            >
                              ▼
                            </button>
                            {q.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newQs = [...questions];
                                  newQs[qIndex].options = newQs[qIndex].options.filter((_: any, idx: number) => idx !== optIndex);
                                  setQuestions(newQs);
                                }}
                                className="p-1 text-red-500 hover:text-red-700 font-bold text-xs"
                                title="Remove pair"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      <button 
                        type="button"
                        onClick={() => { const n = [...questions]; n[qIndex].options.push({left:'', right:''}); setQuestions(n); }} 
                        className="text-xs text-maroon hover:text-maroon-deep font-semibold mt-2"
                      >
                        + Add Matching Pair
                      </button>
                    </div>
                  )}

                  {q.type === 'FILL_BLANK' && (() => {
                    const blankMatches = (q.text || '').match(/\[blank\]/gi) || [];
                    const blankCount = Math.max(1, blankMatches.length);
                    const blankAnswers = Array.isArray(q.answerKey) 
                      ? q.answerKey 
                      : (q.answerKey ? [q.answerKey] : ['']);

                    return (
                      <div className="mt-2 bg-white/60 dark:bg-[#1E1E22] p-4 border border-border-soft rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-green-700 dark:text-green-400 font-bold block">
                            Fill in the Blanks Configuration
                          </Label>
                          <button
                            type="button"
                            onClick={() => {
                              const currentText = q.text || '';
                              updateQuestion(qIndex, 'text', currentText ? `${currentText} [blank]` : 'The capital of France is [blank]');
                            }}
                            className="text-xs text-maroon hover:text-maroon-deep font-bold border border-maroon/30 px-2.5 py-1 rounded-md hover:bg-cream/40 transition-all"
                          >
                            + Insert [blank] tag
                          </button>
                        </div>
                        <p className="text-[11px] text-gray-body">
                          Include <code className="bg-cream/60 px-1 py-0.5 rounded font-mono text-maroon font-bold">[blank]</code> wherever a missing word should appear. For each blank, enter the correct expected answer (multiple acceptable answers can be separated by commas, e.g. "Paris, City of Light").
                        </p>

                        <div className="space-y-2 pt-1">
                          {Array.from({ length: blankCount }).map((_, bIdx) => {
                            const val = blankAnswers[bIdx] || '';
                            return (
                              <div key={bIdx} className="flex items-center gap-3">
                                <span className="text-xs font-bold text-ink min-w-16">
                                  {blankCount > 1 ? `Blank ${bIdx + 1}:` : 'Expected Answer:'}
                                </span>
                                <Input
                                  type="text"
                                  value={val}
                                  onChange={(e) => {
                                    const updated = [...blankAnswers];
                                    while (updated.length < blankCount) updated.push('');
                                    updated[bIdx] = e.target.value;
                                    updateQuestion(qIndex, 'answerKey', blankCount === 1 ? updated[0] : updated);
                                  }}
                                  placeholder={blankCount > 1 ? `Accepted answers for Blank ${bIdx + 1} (comma-separated)` : 'Accepted answers (comma-separated for variants)'}
                                  className="flex-1 bg-white dark:bg-[#18181B] border-green-200 dark:border-green-900/50 focus-visible:ring-green-600 text-ink text-xs"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
            
            <div className="flex justify-between items-center border-t border-border-soft pt-6">
              <Button variant="outline" className="border-border-soft hover:bg-cream/40" onClick={handleAddQuestionRow}>+ Add Another Question</Button>
              <Button onClick={() => handleSaveQuizAndQuestions(false)} disabled={loading || isMismatch} className="bg-maroon hover:bg-maroon-deep text-white font-bold h-10 px-6 rounded-full transition-all disabled:opacity-50">{loading ? 'Saving...' : activeQuizId ? 'Save Quiz Changes' : 'Save & Publish Quiz'}</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activeView === 'view_submissions') {
    const answersPublished = Boolean(activeSubmissionsQuiz?.answersPublished);

    const handleConfirmRestartAttempt = async () => {
      if (!attemptPendingRestart || restartingAttemptId) return;
      const { attemptId } = attemptPendingRestart;
      try {
        setRestartingAttemptId(attemptId);
        const res = await apiClient.fetch(`/api/v1/faculty/quiz/attempt/${attemptId}/allow-restart`, { method: 'POST' });
        const data = await res.json();
        if (!isMountedRef.current) return;
        if (res?.ok !== false && data?.status === 'success') {
          toast.success('Student attempt deleted. Student can now retake the exam.');
          setSubmissions(prev =>
            prev.map(s =>
              s.id === attemptId
                ? {
                    ...s,
                    id: null,
                    hasSubmitted: false,
                    status: 'NOT_SUBMITTED',
                    startTime: null,
                    endTime: null,
                    objectiveScore: null,
                    writtenScore: null,
                    totalScore: null,
                    facultyFeedback: null,
                    violationReason: null,
                    responses: [],
                  }
                : s
            )
          );
          setAttemptPendingRestart(null);
        } else {
          const msg = data?.error?.message || data?.message || 'Failed to allow restart.';
          toast.error(msg);
          throw new Error(msg);
        }
      } finally {
        if (isMountedRef.current) setRestartingAttemptId(null);
      }
    };

    const formatSubmissionDateTime = (sub: any) => {
      if (!sub?.id && !sub?.endTime && !sub?.startTime) return '—';
      const ts = sub.endTime || sub.startTime || sub.createdAt;
      if (!ts) return '—';
      return new Date(ts).toLocaleString();
    };

    const isRowSubmitted = (row: any) =>
      row.hasSubmitted !== undefined
        ? Boolean(row.hasSubmitted)
        : row.status !== 'NOT_SUBMITTED' && row.status !== 'IN_PROGRESS';

    const classScopedSubmissions =
      selectedClassFilter === 'ALL'
        ? submissions
        : submissions.filter(row => row.classKey === selectedClassFilter);

    const totalAssignedCount = classScopedSubmissions.length;
    const submittedCount = classScopedSubmissions.filter(isRowSubmitted).length;
    const notSubmittedCount = totalAssignedCount - submittedCount;
    const violatedCount = classScopedSubmissions.filter(row => Boolean(row.violationReason)).length;

    const filteredSubmissions = classScopedSubmissions.filter(row => {
      if (submissionStatusFilter === 'SUBMITTED') return isRowSubmitted(row);
      if (submissionStatusFilter === 'NOT_SUBMITTED') return !isRowSubmitted(row);
      if (submissionStatusFilter === 'VIOLATED') return Boolean(row.violationReason);
      return true;
    });

    return (
      <>
      <Card className="bg-white dark:bg-[#1E1E22] border border-border-soft text-ink shadow-sm rounded-xl">
        <CardContent className="p-6">
          <div className="flex flex-wrap justify-between items-start gap-4 mb-6 pb-4 border-b border-border-soft">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-serif font-bold text-ink">View Submissions</h2>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    answersPublished
                      ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border-green-200 dark:border-green-900/50'
                      : 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 border-amber-200 dark:border-amber-900/50'
                  }`}
                >
                  {answersPublished ? 'Answers Published' : 'Answers Not Published'}
                </span>
              </div>
              {activeSubmissionsQuiz && (
                <p className="text-xs text-gray-body mt-1">
                  {activeSubmissionsQuiz.title}
                  {activeSubmissionsQuiz.subject ? ` • ${activeSubmissionsQuiz.subject}` : ''}
                  {typeof activeSubmissionsQuiz.totalMarks === 'number' ? ` • Max Marks: ${activeSubmissionsQuiz.totalMarks}` : ''}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!answersPublished ? (
                <Button
                  type="button"
                  onClick={() => setShowPublishConfirm(true)}
                  disabled={publishingAnswers}
                  className="bg-maroon hover:bg-maroon-deep text-white font-bold text-xs rounded-full px-5 shadow-sm"
                >
                  {publishingAnswers ? 'Publishing...' : 'Publish Answers'}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled
                  className="border-green-300 dark:border-green-900/50 text-green-700 dark:text-green-400 bg-green-50/40 dark:bg-green-950/20 text-xs font-bold rounded-full px-5 cursor-default opacity-90"
                >
                  Answers Published
                </Button>
              )}
              <button
                type="button"
                onClick={() => downloadCsv(filteredSubmissions.map(sub => ({
                  student: sub.user?.name,
                  rollNumber: sub.user?.rollNumber,
                  class: sub.classShortLabel || sub.classLabel || '',
                  submittedAt: isRowSubmitted(sub) || sub.id ? formatSubmissionDateTime(sub) : '—',
                  status: sub.status === 'IN_PROGRESS' ? 'ABANDONED' : sub.status === 'NOT_SUBMITTED' ? 'NOT SUBMITTED' : sub.status,
                  totalScore: !isRowSubmitted(sub) ? '—' : answersPublished ? (sub.totalScore ?? 0) : 'Not Published',
                  violation: sub.violationReason || '',
                })), ['student', 'rollNumber', 'class', 'submittedAt', 'status', 'totalScore', 'violation'], `quiz_attempts_${activeQuizId || 'all'}_${new Date().toISOString().slice(0, 10)}`)}
                disabled={filteredSubmissions.length === 0}
                className="rounded-lg border border-border-soft bg-white dark:bg-[#18181B] px-3 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                Export CSV
              </button>
              <button onClick={() => setActiveView('list')} className="text-maroon hover:text-maroon-deep font-semibold text-sm ml-2">Back to Quizzes</button>
            </div>
          </div>
          {submissionsLoading ? (
            <LoadingState label="Loading submissions..." className="min-h-[200px]" />
          ) : submissionsError ? (
            <ErrorState
              message={submissionsError}
              onRetry={() => activeQuizId && handleOpenSubmissions(activeQuizId)}
              className="min-h-[200px]"
            />
          ) : (
            <div className="space-y-5">
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-label="Submission summary">
                <div className="rounded-xl border border-border-soft bg-cream/25 dark:bg-[#242429] p-3.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-gray-body">Total Assigned</div>
                  <div className="text-2xl font-bold text-ink mt-1 tabular-nums">{totalAssignedCount}</div>
                </div>
                <div className="rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50/40 dark:bg-green-950/20 p-3.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400">Submitted</div>
                  <div className="text-2xl font-bold text-green-800 dark:text-green-300 mt-1 tabular-nums">{submittedCount}</div>
                </div>
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 p-3.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">Not Submitted</div>
                  <div className="text-2xl font-bold text-amber-900 dark:text-amber-200 mt-1 tabular-nums">{notSubmittedCount}</div>
                </div>
                <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20 p-3.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">Violated</div>
                  <div className="text-2xl font-bold text-red-800 dark:text-red-300 mt-1 tabular-nums">{violatedCount}</div>
                </div>
              </div>

              {/* Class Tabs + Submission Status Filters */}
              <div className="space-y-3 bg-cream/20 dark:bg-[#242429] border border-border-soft rounded-xl p-3.5">
                {assignedClasses.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Assigned classes">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={selectedClassFilter === 'ALL'}
                      onClick={() => setSelectedClassFilter('ALL')}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
                        selectedClassFilter === 'ALL'
                          ? 'bg-maroon text-white border-maroon shadow-sm'
                          : 'bg-white dark:bg-[#18181B] text-ink border-border-soft hover:bg-cream/50'
                      }`}
                    >
                      All Classes ({submissions.length})
                    </button>
                    {assignedClasses.map(cls => {
                      const clsCount = submissions.filter(row => row.classKey === cls.id).length;
                      const isSelected = selectedClassFilter === cls.id;
                      return (
                        <button
                          key={cls.id}
                          type="button"
                          role="tab"
                          aria-selected={isSelected}
                          onClick={() => setSelectedClassFilter(cls.id)}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
                            isSelected
                              ? 'bg-maroon text-white border-maroon shadow-sm'
                              : 'bg-white dark:bg-[#18181B] text-ink border-border-soft hover:bg-cream/50'
                          }`}
                        >
                          {cls.shortLabel || cls.label} ({clsCount})
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Submission status filters">
                    {([
                      { key: 'ALL', label: 'All Students', count: totalAssignedCount },
                      { key: 'SUBMITTED', label: 'Submitted', count: submittedCount },
                      { key: 'NOT_SUBMITTED', label: 'Not Submitted', count: notSubmittedCount },
                      { key: 'VIOLATED', label: 'Violated', count: violatedCount },
                    ] as const).map(filterItem => {
                      const isActive = submissionStatusFilter === filterItem.key;
                      return (
                        <button
                          key={filterItem.key}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => setSubmissionStatusFilter(filterItem.key)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            isActive
                              ? 'bg-ink text-white border-ink dark:bg-maroon dark:border-maroon'
                              : 'bg-white dark:bg-[#18181B] text-gray-body border-border-soft hover:text-ink hover:bg-cream/40'
                          }`}
                        >
                          {filterItem.label} ({filterItem.count})
                        </button>
                      );
                    })}
                  </div>

                  {(selectedClassFilter !== 'ALL' || submissionStatusFilter !== 'ALL') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClassFilter('ALL');
                        setSubmissionStatusFilter('ALL');
                      }}
                      className="text-xs font-semibold text-maroon hover:underline"
                    >
                      Reset filters
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border-soft">
                      <TableHead className="text-gray-body font-semibold">Student Name</TableHead>
                      <TableHead className="text-gray-body font-semibold">Roll Number</TableHead>
                      <TableHead className="text-gray-body font-semibold">Status</TableHead>
                      <TableHead className="text-gray-body font-semibold">Submitted At</TableHead>
                      <TableHead className="text-gray-body font-semibold">Student Score</TableHead>
                      <TableHead className="text-gray-body font-semibold">Violation</TableHead>
                      <TableHead className="text-gray-body font-semibold text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classScopedSubmissions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="p-0 border-0">
                          <div className="py-8">
                            <EmptyState icon={<Clipboard className="w-8 h-8 text-maroon" />} title="No Submissions" description="There are no eligible students or submissions for this quiz yet." />
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredSubmissions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="p-0 border-0">
                          <div className="py-8">
                            <EmptyState icon={<Clipboard className="w-8 h-8 text-maroon" />} title="No Matching Students" description="No students match the current class or submission filter." />
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSubmissions.map((sub: any) => {
                        const rowSubmitted = isRowSubmitted(sub);
                        const hasAttemptRecord = Boolean(sub.id);
                        const displayStatus =
                          sub.status === 'IN_PROGRESS'
                            ? 'ABANDONED'
                            : sub.status === 'NOT_SUBMITTED'
                            ? 'NOT SUBMITTED'
                            : sub.status;

                        return (
                          <TableRow
                            key={sub.id || `roster-${sub.userId || sub.user?.id}`}
                            className={`border-b border-border-soft hover:bg-cream/20 transition-colors ${
                              sub.violationReason
                                ? 'bg-red-50/30 dark:bg-red-950/20'
                                : sub.status === 'IN_PROGRESS'
                                ? 'bg-yellow-50/30 dark:bg-yellow-950/20'
                                : ''
                            }`}
                          >
                            <TableCell className="py-4">
                              <div className="font-semibold text-ink">{sub.user?.name || 'Student'}</div>
                              {(sub.classShortLabel || sub.classLabel) && sub.classKey !== 'unassigned' && (
                                <div className="text-[11px] text-gray-body mt-0.5">{sub.classShortLabel || sub.classLabel}</div>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-gray-body">{sub.user?.rollNumber || 'N/A'}</TableCell>
                            <TableCell>
                              <span
                                className={`px-2 py-0.5 text-xs font-semibold rounded-full border whitespace-nowrap ${
                                  sub.status === 'EVALUATED'
                                    ? 'bg-green-50/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/50'
                                    : sub.status === 'IN_PROGRESS'
                                    ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-900/50'
                                    : sub.status === 'NOT_SUBMITTED'
                                    ? 'bg-cream/50 dark:bg-[#242429] text-gray-body border-border-soft'
                                    : 'bg-yellow-50/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900/50'
                                }`}
                              >
                                {displayStatus}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-gray-body whitespace-nowrap">
                              {rowSubmitted || hasAttemptRecord ? formatSubmissionDateTime(sub) : '—'}
                            </TableCell>
                            <TableCell className="text-ink">
                              {!rowSubmitted ? (
                                <span className="text-xs text-gray-body/60">—</span>
                              ) : answersPublished ? (
                                <div>
                                  <div className="font-bold text-maroon">{sub.totalScore ?? 0}</div>
                                  <div className="text-[11px] text-gray-body">Auto: {sub.objectiveScore ?? 0} | Written: {sub.writtenScore ?? 0}</div>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-body italic">Hidden until published</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[400px]">
                              {sub.violationReason ? (
                                <div className="px-3 py-2 text-sm font-semibold rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50">
                                  <span className="font-bold">⚠ Violation:</span> {sub.violationReason}
                                </div>
                              ) : sub.status === 'IN_PROGRESS' ? (
                                <div className="px-3 py-2 text-sm font-semibold rounded-lg bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-900/50">
                                  Student left the exam without submitting
                                </div>
                              ) : (
                                <span className="text-xs text-gray-body/50">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {hasAttemptRecord ? (
                                <div className="flex items-center space-x-2">
                                  <Button variant="outline" size="sm" className="border-border-soft hover:bg-cream/40" onClick={() => handleOpenAttempt(sub)}>Review & Grade</Button>
                                  {(sub.violationReason || sub.status === 'IN_PROGRESS') && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={restartingAttemptId === sub.id}
                                      className="border-green-300 dark:border-green-900/50 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 hover:border-green-400"
                                      onClick={() => setAttemptPendingRestart({ attemptId: sub.id, studentName: sub.user?.name || 'Student' })}
                                    >
                                      {restartingAttemptId === sub.id ? 'Restarting...' : 'Allow Restart'}
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-body italic">Not submitted</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <DeleteConfirmationDialog
        open={Boolean(attemptPendingRestart)}
        itemName={attemptPendingRestart ? `${attemptPendingRestart.studentName}'s attempt` : 'this attempt'}
        title="Confirm Deletion"
        description="Deleting this attempt will permanently erase all student answers so they can retake the quiz. This action cannot be undone."
        confirmLabel="Delete"
        onCancel={() => setAttemptPendingRestart(null)}
        onConfirm={handleConfirmRestartAttempt}
      />

      {/* Publish Answers Confirmation Dialog */}
      {showPublishConfirm && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/25 dark:bg-black/60 backdrop-blur-[2px] p-4" role="dialog" aria-modal="true" aria-labelledby="publish-answers-dialog-title">
          <div className="bg-white dark:bg-[#1E1E22] border border-border-soft rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 id="publish-answers-dialog-title" className="text-lg font-serif font-bold text-ink">Publish Quiz Answers?</h3>
            <p className="text-sm text-gray-body leading-relaxed">
              Publishing answers will make quiz results, total scores, submitted answers, correct answers, and question-by-question evaluation visible to all students who submitted{' '}
              <strong className="text-ink">{activeSubmissionsQuiz?.title || 'this quiz'}</strong>.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowPublishConfirm(false)} disabled={publishingAnswers} className="border-border-soft text-xs font-semibold">
                Cancel
              </Button>
              <Button type="button" onClick={handleConfirmPublishAnswers} disabled={publishingAnswers} className="bg-maroon hover:bg-maroon-deep text-white font-bold text-xs rounded-full px-5">
                {publishingAnswers ? 'Publishing...' : 'Confirm & Publish'}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
      </>
    );
  }

  if (activeView === 'evaluate_attempt') {
    return (
      <Card className="bg-white dark:bg-[#1E1E22] border border-border-soft text-ink shadow-sm rounded-xl">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6 border-b border-border-soft pb-4">
            <div>
              <h2 className="text-2xl font-serif font-bold text-ink">Review Attempt: {activeAttempt.user?.name}</h2>
              <div className="text-xs text-gray-body mt-2 flex space-x-6">
                <span>Auto-Graded Objective Score: <strong className="text-maroon text-sm font-semibold">{activeAttempt.objectiveScore}</strong></span>
                <span>Current Written Score: <strong className="text-maroon text-sm font-semibold">{activeAttempt.writtenScore}</strong></span>
                <span>Total Score: <strong className="text-green-700 dark:text-green-400 text-sm font-bold">{activeAttempt.totalScore}</strong></span>
              </div>
            </div>
            <button onClick={() => setActiveView('view_submissions')} className="text-maroon hover:text-maroon-deep font-semibold text-sm">Back to Submissions</button>
          </div>

          <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4">
            {activeAttempt.responses?.map((r: any, idx: number) => {
              const isObjective = ['MCQ', 'MULTI_SELECT', 'NUMERICAL', 'MATCHING', 'FILL_BLANK'].includes(r.question.type);
              return (
                <div key={r.id} className="p-5 bg-cream/30 dark:bg-[#242429] rounded-xl border border-border-soft">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-gray-body font-bold uppercase tracking-wider">Q{idx + 1}. ({r.question.type}) - Marks: {r.question.marks}</span>
                    {isObjective && (
                      <span className="text-xs bg-cream border border-border-soft px-2 py-0.5 rounded text-gray-body font-medium">Auto-Graded</span>
                    )}
                  </div>
                  <div className="text-ink font-semibold text-base mb-4">{r.question.text}</div>
                  {r.question.image && (
                    <div className="mb-4">
                      <img src={r.question.image} alt={`Question ${idx + 1}`} className="max-h-48 rounded-lg border border-border-soft" />
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-[#18181B] p-3 rounded-lg border border-border-soft">
                      <div className="text-xs text-gray-body mb-1 font-semibold">Student's Answer:</div>
                      <div className="text-maroon font-mono text-xs whitespace-pre-wrap">{JSON.stringify(r.answerData, null, 2)}</div>
                    </div>
                    <div className="bg-green-50/10 p-3 rounded-lg border border-green-200 dark:border-green-900/50">
                      <div className="text-xs text-green-700 dark:text-green-400 mb-1 font-semibold">Expected Answer / Key:</div>
                      <div className="text-green-700 dark:text-green-400 font-mono text-xs whitespace-pre-wrap">{JSON.stringify(r.question.answerKey, null, 2)}</div>
                    </div>
                  </div>

                  {!isObjective && (
                    <div className="mt-4 flex items-center justify-end space-x-4 border-t border-border-soft pt-4">
                      <span className="text-sm text-gray-body font-medium">Assign Marks:</span>
                      <Input type="number" value={evaluations[r.id] || 0} onChange={(e) => setEvaluations({...evaluations, [r.id]: Number(e.target.value)})} className="w-24 bg-white dark:bg-[#18181B] border-border-soft text-ink focus-visible:ring-maroon" max={r.question.marks} min={0} step={0.5} />
                      <span className="text-sm text-gray-body">/ {r.question.marks}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8 border-t border-border-soft pt-6">
            <Label className="block mb-2 text-ink font-semibold">Overall Faculty Feedback (Optional)</Label>
            <Textarea value={facultyFeedback} onChange={(e) => setFacultyFeedback(e.target.value)} rows={3} placeholder="Provide general feedback on this attempt..." className="mb-4 bg-white dark:bg-[#18181B] border-border-soft text-ink focus:border-maroon focus:ring-1 focus:ring-maroon" />
            
            <div className="flex justify-end">
              <Button onClick={handleSaveEvaluation} disabled={loading} className="bg-maroon hover:bg-maroon-deep text-white font-bold h-11 px-8 rounded-full transition-all">{loading ? 'Saving...' : 'Save Evaluation'}</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activeView === 'print_paper' && printQuiz) {
    const paperQuestions: any[] = Array.isArray(printQuiz.questions) ? printQuiz.questions : [];
    const paperTotalMarks =
      Number(printQuiz.totalMarks) > 0
        ? Number(printQuiz.totalMarks)
        : paperQuestions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
    const deptNames = (printQuiz.targetDepartments || []).map((d: any) => d.department?.name).filter(Boolean).join(', ');
    const secNames = (printQuiz.targetSections || []).map((s: any) => s.section?.name).filter(Boolean).join(', ');

    return (
      <section className="space-y-5 rounded-xl border border-border-soft bg-white p-6 sm:p-10 text-ink shadow-sm question-paper-print">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft pb-4 print:hidden">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setPrintQuiz(null);
              setActiveView('list');
            }}
            className="border-border-soft hover:bg-cream/40 text-xs font-semibold"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Quizzes
          </Button>
          <Button
            type="button"
            onClick={() => window.print()}
            className="bg-maroon hover:bg-maroon-deep text-white font-bold text-xs rounded-full px-5"
          >
            <Printer className="w-4 h-4 mr-1.5" /> Save PDF / Print
          </Button>
        </div>

        <div className="border-b-2 border-ink/80 pb-4 text-center space-y-1">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-body">
            CIRA · Question Paper{deptNames ? ` · ${deptNames}` : ''}{secNames ? ` (${secNames})` : ''}
          </p>
          <h1 className="text-2xl font-serif font-bold text-ink">{printQuiz.title}</h1>
          <p className="text-sm text-ink/80">
            {printQuiz.subject || 'Subject'} &nbsp;|&nbsp; Duration: {printQuiz.durationMinutes || 60} mins &nbsp;|&nbsp; Max Marks: {paperTotalMarks}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs border-b border-border-soft pb-3">
          <div>Student Name: ______________________________________</div>
          <div>Roll Number: ________________________</div>
        </div>

        {(printQuiz.instructions || printQuiz.description) && (
          <div className="text-xs bg-cream/20 border border-border-soft rounded-lg p-3">
            <span className="font-bold">Instructions: </span>
            <span>{printQuiz.instructions || printQuiz.description}</span>
          </div>
        )}

        {paperQuestions.length === 0 ? (
          <p className="text-sm text-gray-body italic py-6 text-center">No questions have been added to this quiz yet.</p>
        ) : (
          <ol className="list-decimal space-y-6 pl-5">
            {paperQuestions.map((q: any, idx: number) => {
              const displayQuestionText =
                q.type === 'FILL_BLANK'
                  ? String(q.text || '').replace(/\[blank\]/gi, '____________')
                  : String(q.text || '');

              return (
                <li key={q.id || idx} className="break-inside-avoid space-y-2.5">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-medium text-ink whitespace-pre-wrap">{displayQuestionText}</p>
                    <span className="shrink-0 text-xs font-bold text-ink/80">[{q.marks ?? 1} mark{(Number(q.marks) || 1) === 1 ? '' : 's'}]</span>
                  </div>

                  {q.image && (
                    <img src={q.image} alt={`Question ${idx + 1} illustration`} className="my-2 max-h-48 max-w-full object-contain rounded border border-border-soft" />
                  )}

                  {(q.type === 'MCQ' || q.type === 'MULTI_SELECT') && Array.isArray(q.options) && (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-1 text-sm">
                      {q.options.map((opt: any, optIdx: number) => (
                        <li key={optIdx} className="flex items-baseline gap-2">
                          <span className="font-semibold">{String.fromCharCode(65 + optIdx)}.</span>
                          <span>{typeof opt === 'string' ? opt : String(opt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {q.type === 'MATCHING' && Array.isArray(q.options) && (
                    <div className="grid grid-cols-2 gap-6 text-sm pl-1 pt-1">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-body mb-1">Column A</p>
                        <ul className="space-y-1">
                          {q.options.map((pair: any, pIdx: number) => (
                            <li key={pIdx}>{pIdx + 1}. {pair?.left ?? ''}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-body mb-1">Column B</p>
                        <ul className="space-y-1">
                          {[...q.options]
                            .map((pair: any) => String(pair?.right ?? ''))
                            .sort((a, b) => a.localeCompare(b))
                            .map((rightText: string, rIdx: number) => (
                              <li key={rIdx}>{String.fromCharCode(97 + rIdx)}. {rightText}</li>
                            ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {q.type === 'NUMERICAL' && (
                    <p className="text-xs text-gray-body pt-1">Answer: ____________________________</p>
                  )}

                  {(q.type === 'SHORT_WRITTEN' || q.type === 'LONG_WRITTEN') && (
                    <div className="space-y-3 pt-2">
                      <div className="border-b border-border-soft h-4" />
                      <div className="border-b border-border-soft h-4" />
                      {q.type === 'LONG_WRITTEN' && (
                        <>
                          <div className="border-b border-border-soft h-4" />
                          <div className="border-b border-border-soft h-4" />
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        <div className="border-t border-border-soft pt-3 text-right text-xs font-bold text-ink">
          Total Marks: {paperTotalMarks}
        </div>
      </section>
    );
  }

  return (
    <>
    <Card className="bg-white dark:bg-[#1E1E22] border border-border-soft text-ink shadow-sm rounded-xl">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-serif font-bold text-ink">Quiz Management</h2>
          <button
            onClick={() => {
              setActiveQuizId(null);
              setFormData({
                title: '',
                subject: facultySubject,
                description: '',
                totalMarks: '',
                passingMarks: '',
                durationMinutes: '60',
                startDate: '',
                endDate: '',
                targetDepartments: [],
                targetSections: [],
              });
              setQuestions([{ type: 'MCQ', text: '', marks: 1, options: ['', '', '', ''], answerKey: '', topic: '' }]);
              setParsedTotalMarks(0);
              setParsedTotalQuestions(0);
              setWizardStep(1);
              setCompletedWizardSteps([]);
              setStepErrors({});
              setShowDiscardConfirm(false);
              setActiveView('create');
            }}
            className="px-5 py-2 bg-maroon hover:bg-maroon-deep text-white rounded-full text-sm font-bold transition-all shadow-sm hover:scale-105 active:scale-95"
          >
            + Create New Quiz
          </button>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Input aria-label="Search quizzes" value={quizSearch} onChange={event => setQuizSearch(event.target.value)} placeholder="Search quizzes..." className="max-w-sm bg-white border-border-soft text-sm" />
          <button type="button" onClick={() => { clearSavedFilters(quizFilterKey); setQuizSearch(''); }} className="rounded-lg border border-border-soft px-3 py-2 text-sm font-semibold text-ink hover:bg-cream">Reset filters</button>
        </div>

        {quizzesLoading ? (
          <LoadingState label="Loading quizzes..." className="min-h-[200px]" />
        ) : quizzesError ? (
          <ErrorState
            message={quizzesError}
            onRetry={() => void fetchQuizzes(1)}
            className="min-h-[200px]"
          />
        ) : hasFetchedQuizzes && visibleQuizzes.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-8 h-8 text-maroon" />}
            title="No quizzes found"
            description={quizzes.length === 0 ? "You haven't created any quizzes yet." : 'No quizzes match your current search filter.'}
            action={
              quizzes.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    clearSavedFilters(quizFilterKey);
                    setQuizSearch('');
                  }}
                  className="border-border-soft text-xs font-semibold"
                >
                  Clear Search Filter
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div>
            <Table className="w-full lg:table-fixed">
              <TableHeader>
                <TableRow className="border-b border-border-soft">
                  <TableHead className="text-gray-body font-semibold lg:w-[200px]">Title</TableHead>
                  <TableHead className="text-gray-body font-semibold lg:w-[150px]">Subject</TableHead>
                  <TableHead className="text-gray-body font-semibold lg:w-[170px]">Time</TableHead>
                  <TableHead className="text-gray-body font-semibold lg:w-[160px]">Published To</TableHead>
                  <TableHead className="text-gray-body font-semibold text-center lg:w-[90px]">Questions</TableHead>
                  <TableHead className="text-gray-body font-semibold text-center lg:w-[240px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleQuizzes.map((quiz) => (
                  <TableRow key={quiz.id} className="border-b border-border-soft hover:bg-cream/20 transition-colors">
                    <TableCell className="w-[200px] max-w-[200px] whitespace-normal break-words font-semibold text-ink">{quiz.title}</TableCell>
                    <TableCell className="max-w-[150px] whitespace-normal break-words text-gray-body">{quiz.subject}</TableCell>
                    <TableCell className="whitespace-normal text-gray-body text-xs">
                      <div>From: {quiz.startDate ? new Date(quiz.startDate).toLocaleString() : 'Immediately'}</div>
                      <div>Until: {quiz.endDate ? new Date(quiz.endDate).toLocaleString() : 'No end time'}</div>
                    </TableCell>
                    <TableCell className="max-w-[160px] whitespace-normal break-words text-gray-body text-xs">
                      <div>{quiz.targetDepartments?.length ? quiz.targetDepartments.map((target: any) => target.department?.name).filter(Boolean).join(', ') : 'All departments'}</div>
                      <div className="text-ink/60">{quiz.targetSections?.length ? `Sections: ${quiz.targetSections.map((target: any) => target.section?.name).filter(Boolean).join(', ')}` : 'All sections'}</div>
                    </TableCell>
                    <TableCell className="text-center text-ink font-mono text-sm">{quiz._count?.questions || 0}</TableCell>
                    <TableCell className="align-middle py-3">
                      <div className="grid grid-cols-[auto_auto] gap-1.5 sm:gap-2 w-fit mx-auto items-center justify-items-start" data-testid="quiz-actions-grid">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={editingQuizIdLoading !== null}
                          className="h-8 px-3 rounded-lg text-xs font-semibold whitespace-nowrap w-fit border-border-soft hover:bg-cream/40"
                          onClick={() => handleEditQuiz(quiz.id, quiz._count?.attempts || 0)}
                          title="Edit quiz details and questions"
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1 shrink-0" />
                          {editingQuizIdLoading === quiz.id ? 'Loading...' : 'Edit'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 rounded-lg text-xs font-semibold whitespace-nowrap w-fit border-border-soft hover:bg-cream/40"
                          onClick={() => handleOpenSubmissions(quiz.id)}
                        >
                          View Submissions
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={printingQuizIdLoading !== null}
                          className="h-8 px-3 rounded-lg text-xs font-semibold whitespace-nowrap w-fit border-border-soft hover:bg-cream/40"
                          onClick={() => void handlePrintQuestionPaper(quiz.id)}
                          title="Download or print question paper PDF without answers"
                        >
                          <Printer className="w-3.5 h-3.5 mr-1 shrink-0" />
                          {printingQuizIdLoading === quiz.id ? 'Preparing...' : 'Print'}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8 px-3 rounded-lg text-xs font-semibold whitespace-nowrap w-fit bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-900/50"
                          onClick={() => setQuizPendingDelete({ id: quiz.id, title: quiz.title || 'this quiz' })}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {!quizzesLoading && !quizzesError && hasMore && (
          <div className="mt-6 flex justify-center">
            <Button
              variant="outline"
              disabled={loadingMoreQuizzes}
              onClick={() => void fetchQuizzes(page + 1)}
              className="border-maroon text-maroon hover:bg-maroon hover:text-white rounded-full px-8 py-2 font-bold transition-all shadow-sm"
            >
              {loadingMoreQuizzes ? 'Loading more...' : 'Load More'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>

    <DeleteConfirmationDialog
      open={Boolean(quizPendingDelete)}
      itemName={quizPendingDelete?.title || 'this quiz'}
      title="Confirm Deletion"
      description="This action will permanently delete the quiz and its question setup. This action cannot be undone."
      confirmLabel="Delete"
      onCancel={() => setQuizPendingDelete(null)}
      onConfirm={handleConfirmDeleteQuiz}
    />
    </>
  );
}
