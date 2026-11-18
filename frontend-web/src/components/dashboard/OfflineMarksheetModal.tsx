import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  Plus,
  Trash2,
  Download,
  Copy,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { apiClient } from '@/lib/apiClient';
import { downloadCsv, parseCsv } from '@/lib/csv';
import { toast } from 'sonner';

export interface QuestionDef {
  questionNumber: number;
  topic: string;
  maxMarks: number;
  questionText?: string;
}

export interface MarksheetRow {
  id: string;
  identifier: string;
  studentName?: string;
  questionScores: Record<string, number | string>;
  totalScore?: number | string;
  matched?: boolean;
  matchedStudentName?: string;
  matchedRollNumber?: string;
  errors?: string[];
}

export interface ClassOption {
  id: string;
  label: string;
  departmentId?: string;
  sectionId?: string;
}

interface OfflineMarksheetModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (newQuizId: string) => void;
  availableClasses?: ClassOption[];
  suggestedTopics?: string[];
}

const AI_PROMPT_TEMPLATE = `Extract all questions, their core topic tags, and maximum marks from the question paper below. Format the output strictly as one question per line using this exact format (no extra text, markdown, or numbering explanations):
Q1, <Topic Name>, <Max Marks>
Q2, <Topic Name>, <Max Marks>

Question Paper:
[Paste your question paper here]`;

export const OfflineMarksheetModal: React.FC<OfflineMarksheetModalProps> = ({
  open,
  onClose,
  onSuccess,
  availableClasses = [],
  suggestedTopics = []
}) => {
  // Wizard state: Step 1 (Blueprint & Settings) -> Step 2 (Upload & Verify Marks)
  const [step, setStep] = useState<1 | 2>(1);

  // Core quiz metadata
  const [mode, setMode] = useState<'QUESTION_WISE' | 'TOTAL_ONLY'>('QUESTION_WISE');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [totalMarksB, setTotalMarksB] = useState<number>(50);
  const [answersPublished, setAnswersPublished] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classError, setClassError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);

  // Classes fallback loading
  const [loadedClasses, setLoadedClasses] = useState<ClassOption[]>(availableClasses);

  // Step 1: Mode A Questions
  const [questions, setQuestions] = useState<QuestionDef[]>([
    { questionNumber: 1, topic: 'Core Concepts', maxMarks: 5 },
    { questionNumber: 2, topic: 'Problem Solving', maxMarks: 10 }
  ]);
  const [rawBlueprintText, setRawBlueprintText] = useState('');
  const [showBlueprintParser, setShowBlueprintParser] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Step 1: Mode B Topics
  const [overallTopics, setOverallTopics] = useState<string[]>(['General']);
  const [topicInput, setTopicInput] = useState('');

  // Step 2: Marksheet rows & validation
  const [rows, setRows] = useState<MarksheetRow[]>([
    { id: '1', identifier: '', studentName: '', questionScores: { '1': '', '2': '' }, totalScore: '' }
  ]);
  const [rowStatusFilter, setRowStatusFilter] = useState<'ALL' | 'VALID' | 'ISSUES'>('ALL');
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [validationSummary, setValidationSummary] = useState<{
    validRowsCount: number;
    invalidRowsCount: number;
    totalRows: number;
    readyToImport: boolean;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Mode A computed total marks
  const computedTotalMarksA = useMemo(() => {
    return questions.reduce((sum, q) => sum + (Number(q.maxMarks) || 0), 0);
  }, [questions]);

  const activeTotalMarks = mode === 'QUESTION_WISE' ? computedTotalMarksA : (Number(totalMarksB) || 50);

  // Fetch classes if none passed via props
  useEffect(() => {
    if (availableClasses && availableClasses.length > 0) {
      setLoadedClasses(availableClasses);
      return;
    }
    const fetchClasses = async () => {
      try {
        const res = await apiClient.fetch('/api/v1/faculty/quiz/question-papers/classes');
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.data?.classes)) {
          const mapped: ClassOption[] = data.data.classes.map((c: any) => ({
            id: c.type === 'SECTION' ? `section:${c.id}` : `dept:${c.id}`,
            label: `${c.batch ? `${c.batch} • ` : ''}${c.name}`,
            departmentId: c.type === 'DEPARTMENT' ? c.id : undefined,
            sectionId: c.type === 'SECTION' ? c.id : undefined
          }));
          setLoadedClasses(mapped);
        }
      } catch (err) {
        console.warn('Failed to load classes for offline marksheet:', err);
      }
    };
    if (open) {
      void fetchClasses();
    }
  }, [open, availableClasses]);

  // Reset state on modal open
  useEffect(() => {
    if (open) {
      setStep(1);
      setTitle('');
      setSubject('');
      setSelectedClassId('');
      setClassError(null);
      setTitleError(null);
      setRows([{ id: '1', identifier: '', studentName: '', questionScores: { '1': '', '2': '' }, totalScore: '' }]);
      setValidationSummary(null);
      setRowStatusFilter('ALL');
    }
  }, [open]);

  // Synchronize questionScores on rows when questions change in Mode A
  useEffect(() => {
    if (mode === 'QUESTION_WISE') {
      setRows(prevRows =>
        prevRows.map(r => {
          const nextScores = { ...r.questionScores };
          questions.forEach(q => {
            const k = String(q.questionNumber);
            if (nextScores[k] === undefined) nextScores[k] = '';
          });
          return { ...r, questionScores: nextScores };
        })
      );
    }
  }, [questions, mode]);

  // Question editing handlers
  const handleAddQuestion = () => {
    const nextNum = questions.length > 0 ? Math.max(...questions.map(q => q.questionNumber)) + 1 : 1;
    setQuestions([...questions, { questionNumber: nextNum, topic: 'Topic ' + nextNum, maxMarks: 5 }]);
  };

  const handleRemoveQuestion = (idx: number) => {
    if (questions.length <= 1) {
      toast.error('At least one question is required.');
      return;
    }
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const handleUpdateQuestion = (idx: number, field: keyof QuestionDef, val: any) => {
    const updated = [...questions];
    updated[idx] = { ...updated[idx], [field]: val };
    setQuestions(updated);
  };

  // Copy AI Prompt handler
  const handleCopyAiPrompt = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(AI_PROMPT_TEMPLATE);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = AI_PROMPT_TEMPLATE;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedPrompt(true);
      toast.success('AI Prompt copied! Paste into ChatGPT, Gemini, or Claude along with your question paper.');
      setTimeout(() => setCopiedPrompt(false), 3000);
    } catch {
      toast.error('Failed to copy prompt to clipboard. Please copy manually.');
    }
  };

  // Quick Parse Blueprint from pasted text
  const handleParseBlueprintText = () => {
    if (!rawBlueprintText.trim()) return;
    const lines = rawBlueprintText.split(/\r?\n/).filter(l => l.trim().length > 0);
    const parsedQuestions: QuestionDef[] = [];

    lines.forEach((line, index) => {
      const commaParts = line.split(/[,;\t]/).map(p => p.trim());
      if (commaParts.length >= 3) {
        const qNum = parseInt(commaParts[0].replace(/\D/g, ''), 10) || (index + 1);
        const topic = commaParts[1] || 'General';
        const marks = parseFloat(commaParts[2].replace(/[^0-9.]/g, '')) || 5;
        parsedQuestions.push({ questionNumber: qNum, topic, maxMarks: marks });
      } else {
        const marksMatch = line.match(/(\d+(?:\.\d+)?)\s*(?:marks?|pts?|points?)/i);
        const marks = marksMatch ? parseFloat(marksMatch[1]) : 5;
        const cleaned = line.replace(/(\d+(?:\.\d+)?)\s*(?:marks?|pts?|points?)/i, '').replace(/^[qQ]?\d+[\s.:)\-]*/, '').trim();
        parsedQuestions.push({
          questionNumber: index + 1,
          topic: cleaned || `Question ${index + 1}`,
          maxMarks: marks
        });
      }
    });

    if (parsedQuestions.length > 0) {
      setQuestions(parsedQuestions);
      setShowBlueprintParser(false);
      setRawBlueprintText('');
      toast.success(`Successfully parsed ${parsedQuestions.length} questions into blueprint!`);
    } else {
      toast.error('Could not parse question structure. Please use format: Q1, Topic, Marks');
    }
  };

  // Step 1 -> Step 2 validation & transition
  const handleProceedToStep2 = () => {
    let hasError = false;
    if (!title.trim()) {
      setTitleError('Quiz title is required.');
      hasError = true;
    } else {
      setTitleError(null);
    }

    if (!selectedClassId || selectedClassId === 'ALL') {
      setClassError('Please select a target class before importing marks.');
      hasError = true;
    } else {
      setClassError(null);
    }

    if (mode === 'QUESTION_WISE') {
      const invalidQ = questions.find(q => !q.maxMarks || q.maxMarks <= 0);
      if (invalidQ) {
        toast.error(`Question ${invalidQ.questionNumber} must have max marks greater than 0.`);
        hasError = true;
      }
    }

    if (hasError) return;
    setStep(2);
  };

  // Add / Remove Topic in Mode B
  const handleAddTopic = () => {
    const clean = topicInput.trim();
    if (!clean) return;
    if (!overallTopics.includes(clean)) {
      setOverallTopics([...overallTopics, clean]);
    }
    setTopicInput('');
  };

  const handleRemoveTopic = (t: string) => {
    setOverallTopics(overallTopics.filter(item => item !== t));
  };

  // Download sample CSV template
  const handleDownloadTemplate = () => {
    if (!selectedClassId) {
      toast.error('Please select a target class in Step 1 first.');
      return;
    }

    if (mode === 'QUESTION_WISE') {
      const headers = ['Roll Number / Email', 'Student Name'];
      questions.forEach(q => headers.push(`Q${q.questionNumber} (${q.topic} - ${q.maxMarks}m)`));

      const sampleRows = [
        {
          [headers[0]]: '21CS001',
          [headers[1]]: 'Sample Student 1',
          ...questions.reduce((acc, q) => ({ ...acc, [`Q${q.questionNumber} (${q.topic} - ${q.maxMarks}m)`]: Math.round(q.maxMarks * 0.8) }), {})
        },
        {
          [headers[0]]: 'student@college.edu',
          [headers[1]]: 'Sample Student 2',
          ...questions.reduce((acc, q) => ({ ...acc, [`Q${q.questionNumber} (${q.topic} - ${q.maxMarks}m)`]: Math.round(q.maxMarks * 0.9) }), {})
        }
      ];
      downloadCsv(sampleRows, headers, `marksheet_template_${title ? title.replace(/\s+/g, '_') : 'quiz'}_modeA`);
    } else {
      const headers = ['Roll Number / Email', 'Student Name', `Total Marks (Max ${activeTotalMarks})`];
      const sampleRows = [
        { [headers[0]]: '21CS001', [headers[1]]: 'Sample Student 1', [headers[2]]: Math.round(activeTotalMarks * 0.85) },
        { [headers[0]]: 'student@college.edu', [headers[1]]: 'Sample Student 2', [headers[2]]: Math.round(activeTotalMarks * 0.9) }
      ];
      downloadCsv(sampleRows, headers, `marksheet_template_${title ? title.replace(/\s+/g, '_') : 'quiz'}_modeB`);
    }
    toast.success('Sample template downloaded.');
  };

  // Row manipulations
  const handleAddRow = () => {
    setRows([
      ...rows,
      {
        id: String(Date.now() + Math.random()),
        identifier: '',
        studentName: '',
        questionScores: {},
        totalScore: ''
      }
    ]);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length <= 1) {
      setRows([{ id: '1', identifier: '', studentName: '', questionScores: {}, totalScore: '' }]);
      setValidationSummary(null);
      return;
    }
    setRows(rows.filter(r => r.id !== id));
  };

  const handleUpdateRowScore = (rowId: string, qNum: number, val: string) => {
    setRows(prev =>
      prev.map(r => {
        if (r.id !== rowId) return r;
        return {
          ...r,
          questionScores: { ...r.questionScores, [String(qNum)]: val }
        };
      })
    );
  };

  // File upload parser (CSV or XLSX)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const isCsv = file.name.endsWith('.csv');
      if (isCsv) {
        const text = await file.text();
        const parsedData = parseCsv(text);
        if (parsedData.length === 0) {
          toast.error('The uploaded CSV file contains no data rows.');
          return;
        }

        const newRows: MarksheetRow[] = parsedData.map((raw, idx) => {
          const keys = Object.keys(raw);
          const findKey = (re: RegExp) => keys.find(k => re.test(k.trim().toLowerCase()));

          const idKey = findKey(/^(roll|registration|reg|email|student\s*id|identifier)/i) || keys[0];
          const nameKey = findKey(/^(name|student\s*name)/i);
          const totalKey = findKey(/^(total|obtained|score|marks)/i);

          const qScores: Record<string, number | string> = {};
          if (mode === 'QUESTION_WISE') {
            questions.forEach(q => {
              const qKey = findKey(new RegExp(`^(q\\s*${q.questionNumber}|question\\s*${q.questionNumber})`, 'i'));
              if (qKey && raw[qKey] !== '') {
                qScores[String(q.questionNumber)] = raw[qKey];
              } else {
                qScores[String(q.questionNumber)] = '';
              }
            });
          }

          return {
            id: String(idx + 1),
            identifier: String(raw[idKey] || '').trim(),
            studentName: nameKey ? String(raw[nameKey] || '').trim() : undefined,
            questionScores: qScores,
            totalScore: totalKey ? String(raw[totalKey] || '').trim() : ''
          };
        });

        setRows(newRows);
        toast.success(`Loaded ${newRows.length} rows from CSV.`);
        void runValidation(newRows);
      } else {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('mode', mode);
        if (mode === 'QUESTION_WISE') {
          formData.append('questions', JSON.stringify(questions));
        }

        const res = await apiClient.fetch('/api/v1/faculty/quiz/offline-marksheet/parse-file', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.status === 'success' && data.data?.rows) {
          const loadedRows: MarksheetRow[] = data.data.rows.map((r: any, idx: number) => ({
            id: String(idx + 1),
            identifier: r.identifier,
            studentName: r.studentName,
            questionScores: r.questionScores || {},
            totalScore: r.totalScore !== undefined ? String(r.totalScore) : ''
          }));
          setRows(loadedRows);
          toast.success(`Loaded ${loadedRows.length} rows from spreadsheet.`);
          void runValidation(loadedRows);
        } else {
          toast.error(data.message || 'Failed to parse spreadsheet file.');
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Error reading file: ' + (err.message || 'Unknown error'));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Run server validation
  const runValidation = async (rowsToValidate: MarksheetRow[] = rows) => {
    if (!selectedClassId || selectedClassId === 'ALL') {
      setClassError('Please select a target class before validating.');
      toast.error('Target class is required. Please choose a class in Step 1.');
      return;
    }

    const cleanRows = rowsToValidate.filter(r => r.identifier.trim().length > 0);
    if (cleanRows.length === 0) {
      toast.error('Please enter at least one student roll number or email.');
      return;
    }

    setValidating(true);
    try {
      const selectedClass = loadedClasses.find(c => c.id === selectedClassId);
      const res = await apiClient.fetch('/api/v1/faculty/quiz/offline-marksheet/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          totalMarks: activeTotalMarks,
          targetClassId: selectedClassId,
          targetDepartmentIds: selectedClass?.departmentId ? [selectedClass.departmentId] : undefined,
          targetSectionIds: selectedClass?.sectionId ? [selectedClass.sectionId] : undefined,
          questions: mode === 'QUESTION_WISE' ? questions : undefined,
          overallTopics: mode === 'TOTAL_ONLY' ? overallTopics : undefined,
          rows: cleanRows.map(r => ({
            identifier: r.identifier.trim(),
            studentName: r.studentName,
            questionScores: mode === 'QUESTION_WISE' ? r.questionScores : undefined,
            totalScore: mode === 'TOTAL_ONLY' ? Number(r.totalScore || 0) : undefined
          }))
        })
      });

      const data = await res.json();
      if (data.status === 'success' && data.data) {
        setValidationSummary(data.data.summary);

        const validatedMap = new Map<string, any>();
        data.data.rows.forEach((vr: any) => {
          validatedMap.set(vr.identifier.toLowerCase(), vr);
        });

        setRows(prevRows =>
          prevRows.map(r => {
            const vr = validatedMap.get(r.identifier.trim().toLowerCase());
            if (vr) {
              return {
                ...r,
                matched: vr.matched,
                matchedStudentName: vr.student?.name,
                matchedRollNumber: vr.student?.rollNumber,
                errors: vr.errors,
                totalScore: vr.totalScore
              };
            }
            return r;
          })
        );

        if (data.data.summary.invalidRowsCount === 0) {
          toast.success(`All ${data.data.summary.validRowsCount} students verified and matched!`);
        } else {
          toast.warning(`${data.data.summary.validRowsCount} verified, ${data.data.summary.invalidRowsCount} issues need attention.`);
        }
      } else {
        toast.error(data.message || 'Validation failed');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Validation error: ' + (err.message || 'Network error'));
    } finally {
      setValidating(false);
    }
  };

  // Submit and commit offline marksheet import
  const handleImportSubmit = async () => {
    if (!title.trim()) {
      toast.error('Please enter a Quiz Title.');
      setStep(1);
      return;
    }

    if (!selectedClassId || selectedClassId === 'ALL') {
      toast.error('Please select a target class.');
      setStep(1);
      return;
    }

    const cleanRows = rows.filter(r => r.identifier.trim().length > 0);
    if (cleanRows.length === 0) {
      toast.error('No student marks to import.');
      return;
    }

    // Check if there are unverified or errored rows
    const erroredRows = cleanRows.filter(r => r.matched === false || (r.errors && r.errors.length > 0));
    if (erroredRows.length > 0) {
      toast.error(`Cannot import: ${erroredRows.length} student row(s) have unresolved errors. Please fix or remove them.`);
      return;
    }

    setImporting(true);
    try {
      const selectedClass = loadedClasses.find(c => c.id === selectedClassId);
      const res = await apiClient.fetch('/api/v1/faculty/quiz/offline-marksheet/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          subject: subject.trim() || undefined,
          mode,
          totalMarks: activeTotalMarks,
          answersPublished,
          targetClassId: selectedClassId,
          targetDepartmentIds: selectedClass?.departmentId ? [selectedClass.departmentId] : undefined,
          targetSectionIds: selectedClass?.sectionId ? [selectedClass.sectionId] : undefined,
          questions: mode === 'QUESTION_WISE' ? questions : undefined,
          overallTopics: mode === 'TOTAL_ONLY' ? overallTopics : undefined,
          rows: cleanRows.map(r => ({
            identifier: r.identifier.trim(),
            questionScores: mode === 'QUESTION_WISE' ? r.questionScores : undefined,
            totalScore: mode === 'TOTAL_ONLY' ? Number(r.totalScore || 0) : undefined
          }))
        })
      });

      const data = await res.json();
      if (res?.ok && data.status === 'success' && data.data?.quizId) {
        toast.success(data.message || 'Offline marksheet imported successfully!');
        onSuccess(data.data.quizId);
        onClose();
      } else {
        const errorMsg = data?.error?.message || data?.message || 'Failed to import offline marksheet.';
        toast.error(errorMsg);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Import error: ' + (err.message || 'Network error'));
    } finally {
      setImporting(false);
    }
  };

  // Filtered rows for Step 2 table
  const displayedRows = useMemo(() => {
    if (rowStatusFilter === 'VALID') {
      return rows.filter(r => r.matched && (!r.errors || r.errors.length === 0));
    }
    if (rowStatusFilter === 'ISSUES') {
      return rows.filter(r => r.matched === false || (r.errors && r.errors.length > 0));
    }
    return rows;
  }, [rows, rowStatusFilter]);

  const selectedClassLabel = loadedClasses.find(c => c.id === selectedClassId)?.label || 'No class selected';

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-[#18181B] rounded-2xl border border-border-soft dark:border-neutral-800 shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Wizard Header */}
        <div className="p-4 sm:p-5 border-b border-border-soft dark:border-neutral-800 flex items-center justify-between gap-4 bg-slate-50/70 dark:bg-neutral-900/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-maroon/10 text-maroon flex items-center justify-center font-bold text-base shrink-0">
              📝
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-serif font-bold text-ink dark:text-neutral-100">
                  Import External Marksheet
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 uppercase tracking-wide">
                  Offline Assessment
                </span>
              </div>
              <p className="text-xs text-gray-body dark:text-neutral-400">
                Upload offline classroom test scores and connect them directly to student topic performance reports.
              </p>
            </div>
          </div>

          {/* Step Pill Navigation */}
          <div className="hidden sm:flex items-center gap-2 bg-cream/50 dark:bg-neutral-800 p-1 rounded-xl border border-border-soft dark:border-neutral-700">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                step === 1
                  ? 'bg-maroon text-white shadow-xs'
                  : 'text-gray-body dark:text-neutral-400 hover:text-ink'
              }`}
            >
              1. Quiz & Blueprint
            </button>
            <button
              type="button"
              onClick={handleProceedToStep2}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                step === 2
                  ? 'bg-maroon text-white shadow-xs'
                  : 'text-gray-body dark:text-neutral-400 hover:text-ink'
              }`}
            >
              2. Upload & Verify Marks
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-body hover:text-ink hover:bg-cream/60 dark:hover:bg-neutral-800 transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Wizard Step 1 vs Step 2 */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {step === 1 ? (
            /* STEP 1: Quiz & Topic Blueprint */
            <div className="space-y-6">
              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Left Card: Basic Info & Mandatory Class Selection */}
                <div className="space-y-4 p-4 rounded-xl border border-border-soft dark:border-neutral-800 bg-cream/10 dark:bg-neutral-900/20">
                  <h3 className="font-serif font-bold text-sm text-ink dark:text-neutral-200 uppercase tracking-wider text-xs">
                    Assessment Details
                  </h3>

                  <div>
                    <Label className="text-xs font-bold text-ink dark:text-neutral-200">
                      Quiz Title <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="e.g. Midterm 1 - Data Structures (Offline)"
                      value={title}
                      onChange={e => {
                        setTitle(e.target.value);
                        if (titleError) setTitleError(null);
                      }}
                      className={`mt-1 h-9 text-sm ${titleError ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    />
                    {titleError && (
                      <p className="text-xs text-red-500 font-medium mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {titleError}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs font-bold text-ink dark:text-neutral-200">Subject / Course</Label>
                    <Input
                      placeholder="e.g. Computer Science & Engineering"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      className="mt-1 h-9 text-sm"
                    />
                  </div>

                  {/* Mandatory Class Selection */}
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-ink dark:text-neutral-200">
                        Target Class / Section <span className="text-red-500">* (Required)</span>
                      </Label>
                      <span className="text-[11px] text-gray-body dark:text-neutral-400">Class-level scoping</span>
                    </div>
                    <select
                      value={selectedClassId}
                      onChange={e => {
                        setSelectedClassId(e.target.value);
                        if (classError) setClassError(null);
                      }}
                      className={`mt-1 w-full h-9 px-3 rounded-lg border text-sm bg-white dark:bg-[#222227] text-ink dark:text-neutral-100 font-medium focus:outline-none focus:ring-1 focus:ring-maroon ${
                        classError
                          ? 'border-red-500 ring-1 ring-red-500'
                          : 'border-border-soft dark:border-neutral-700'
                      }`}
                    >
                      <option value="">-- Select Target Class / Section (Required) --</option>
                      {loadedClasses.map(cls => (
                        <option key={cls.id} value={cls.id}>
                          {cls.label}
                        </option>
                      ))}
                    </select>
                    {classError ? (
                      <p className="text-xs text-red-500 font-medium mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {classError}
                      </p>
                    ) : (
                      <p className="text-[11px] text-gray-body dark:text-neutral-400 mt-1">
                        Select the exact class or section whose marks you are importing.
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Card: Assessment Mode & Publishing */}
                <div className="space-y-4 p-4 rounded-xl border border-border-soft dark:border-neutral-800 bg-cream/10 dark:bg-neutral-900/20">
                  <h3 className="font-serif font-bold text-sm text-ink dark:text-neutral-200 uppercase tracking-wider text-xs">
                    Import Mode & Visibility
                  </h3>

                  {/* Mode Buttons */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setMode('QUESTION_WISE')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        mode === 'QUESTION_WISE'
                          ? 'border-maroon bg-maroon/5 ring-1 ring-maroon'
                          : 'border-border-soft dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600 bg-white dark:bg-[#222227]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-ink dark:text-neutral-100">
                          Question-to-Topic Mapping
                        </span>
                        {mode === 'QUESTION_WISE' && <CheckCircle2 className="w-4 h-4 text-maroon" />}
                      </div>
                      <p className="text-[11px] text-gray-body dark:text-neutral-400 leading-snug">
                        Full question-wise breakdown mapping each question to a topic tag.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode('TOTAL_ONLY')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        mode === 'TOTAL_ONLY'
                          ? 'border-maroon bg-maroon/5 ring-1 ring-maroon'
                          : 'border-border-soft dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600 bg-white dark:bg-[#222227]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-ink dark:text-neutral-100">
                          Total Score Only
                        </span>
                        {mode === 'TOTAL_ONLY' && <CheckCircle2 className="w-4 h-4 text-maroon" />}
                      </div>
                      <p className="text-[11px] text-gray-body dark:text-neutral-400 leading-snug">
                        Rapid marks entry with overall topic tags.
                      </p>
                    </button>
                  </div>

                  {/* Mode-specific settings */}
                  {mode === 'QUESTION_WISE' ? (
                    <div className="p-3 rounded-lg bg-white dark:bg-[#222227] border border-border-soft dark:border-neutral-700 text-xs text-gray-body dark:text-neutral-300 flex items-center justify-between">
                      <span>Total Calculated Marks:</span>
                      <span className="text-base font-bold text-maroon dark:text-rose-400">
                        {computedTotalMarksA} Marks
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs font-bold text-ink dark:text-neutral-200">
                          Total Quiz Maximum Marks
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          value={totalMarksB}
                          onChange={e => setTotalMarksB(Math.max(1, Number(e.target.value) || 0))}
                          className="mt-1 h-9 text-sm w-36"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-ink dark:text-neutral-200">
                          Curriculum Topic Tags
                        </Label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            placeholder="Add topic (e.g. Dynamic Programming)..."
                            value={topicInput}
                            list="suggested-topics-list"
                            onChange={e => setTopicInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddTopic();
                              }
                            }}
                            className="h-8 text-xs"
                          />
                          <Button type="button" size="sm" onClick={handleAddTopic} variant="outline" className="h-8 text-xs shrink-0">
                            Add
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {overallTopics.map(t => (
                            <span
                              key={t}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-cream dark:bg-neutral-800 text-ink dark:text-neutral-200 border border-border-soft"
                            >
                              {t}
                              <button type="button" onClick={() => handleRemoveTopic(t)} className="text-gray-400 hover:text-red-500">
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Publish Answers Toggle */}
                  <div className="pt-2 border-t border-border-soft dark:border-neutral-800 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-ink dark:text-neutral-200 block">
                        Publish Marks to Students
                      </span>
                      <span className="text-[11px] text-gray-body dark:text-neutral-400">
                        Make scores visible in student profiles immediately
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={answersPublished}
                      onChange={e => setAnswersPublished(e.target.checked)}
                      className="w-4 h-4 accent-maroon rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Mode A: Question Blueprint Editor */}
              {mode === 'QUESTION_WISE' && (
                <div className="border border-border-soft dark:border-neutral-800 rounded-xl p-4 sm:p-5 bg-white dark:bg-[#1E1E24] space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-ink dark:text-neutral-100 uppercase tracking-wider">
                        Question-to-Topic Blueprint
                      </h3>
                      <p className="text-xs text-gray-body dark:text-neutral-400">
                        Define each question, its curriculum topic tag, and max marks.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Copy AI Prompt Button */}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleCopyAiPrompt}
                        className="h-8 text-xs bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 hover:bg-amber-100"
                        title="Copy ready-to-use prompt for ChatGPT, Gemini, or Claude to parse your question paper"
                      >
                        {copiedPrompt ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1 text-amber-700" />}
                        {copiedPrompt ? 'Prompt Copied!' : 'Copy AI Prompt'}
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setShowBlueprintParser(!showBlueprintParser)}
                        className="h-8 text-xs bg-cream/40 border-border-soft"
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1 text-maroon" />
                        {showBlueprintParser ? 'Hide Quick Paste' : 'Paste Blueprint'}
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddQuestion}
                        className="h-8 text-xs bg-maroon hover:bg-maroon-deep text-white"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add Question
                      </Button>
                    </div>
                  </div>

                  {/* Quick Blueprint Textarea Parser */}
                  {showBlueprintParser && (
                    <div className="p-4 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 space-y-3">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs font-bold text-amber-900 dark:text-amber-300">
                          Paste Questions & Topics (Format: Q#, Topic, Max Marks)
                        </Label>
                        <span className="text-[11px] text-amber-800/80 dark:text-amber-400">One question per line</span>
                      </div>
                      <textarea
                        rows={4}
                        placeholder={`Q1, Sorting Algorithms, 5\nQ2, Binary Search Trees, 10\nQ3, Dynamic Programming, 15`}
                        value={rawBlueprintText}
                        onChange={e => setRawBlueprintText(e.target.value)}
                        className="w-full p-2.5 text-xs font-mono rounded-lg border border-amber-300/80 dark:border-amber-800/60 bg-white dark:bg-[#1A1A1E] text-ink dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setShowBlueprintParser(false)}
                          className="h-7 text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleParseBlueprintText}
                          className="h-7 text-xs bg-amber-700 hover:bg-amber-800 text-white"
                        >
                          Apply Blueprint
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Blueprint Dynamic Questions Table */}
                  <div className="border border-border-soft dark:border-neutral-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 font-bold uppercase tracking-wider border-b border-border-soft">
                        <tr>
                          <th className="py-2.5 px-3 w-16 text-center">#</th>
                          <th className="py-2.5 px-3">Curriculum Topic Tag</th>
                          <th className="py-2.5 px-3 w-32">Max Marks</th>
                          <th className="py-2.5 px-3 w-16 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-soft dark:divide-neutral-800">
                        {questions.map((q, idx) => (
                          <tr key={idx} className="hover:bg-cream/20 dark:hover:bg-neutral-800/40">
                            <td className="py-2 px-3 text-center font-bold text-gray-500">
                              Q{q.questionNumber}
                            </td>
                            <td className="py-2 px-3">
                              <Input
                                value={q.topic}
                                list="suggested-topics-list"
                                placeholder="Topic name (e.g. Recursion, SQL)..."
                                onChange={e => handleUpdateQuestion(idx, 'topic', e.target.value)}
                                className="h-8 text-xs font-medium"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1.5">
                                <Input
                                  type="number"
                                  min={1}
                                  value={q.maxMarks}
                                  onChange={e => handleUpdateQuestion(idx, 'maxMarks', Math.max(1, Number(e.target.value) || 0))}
                                  className="h-8 text-xs font-bold w-20 text-center"
                                />
                                <span className="text-gray-400 text-xs">marks</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveQuestion(idx)}
                                className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                title="Remove question"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {suggestedTopics && suggestedTopics.length > 0 && (
                    <datalist id="suggested-topics-list">
                      {suggestedTopics.map(t => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* STEP 2: Upload / Verify Student Marks */
            <div className="space-y-4">
              {/* Context Strip */}
              <div className="p-3.5 rounded-xl border border-border-soft dark:border-neutral-800 bg-cream/20 dark:bg-neutral-900/30 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap text-xs">
                  <div>
                    <span className="text-gray-body dark:text-neutral-400">Quiz: </span>
                    <strong className="text-ink dark:text-neutral-100">{title}</strong>
                  </div>
                  <span className="text-gray-300 dark:text-neutral-700">•</span>
                  <div>
                    <span className="text-gray-body dark:text-neutral-400">Class: </span>
                    <strong className="text-ink dark:text-neutral-100">{selectedClassLabel}</strong>
                  </div>
                  <span className="text-gray-300 dark:text-neutral-700">•</span>
                  <div>
                    <span className="text-gray-body dark:text-neutral-400">Total Marks: </span>
                    <strong className="text-maroon dark:text-rose-400">{activeTotalMarks} Marks</strong>
                  </div>
                  <span className="text-gray-300 dark:text-neutral-700">•</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cream-edge/30 text-ink dark:text-neutral-200">
                    {mode === 'QUESTION_WISE' ? `${questions.length} Questions Mapped` : 'Total Score Mode'}
                  </span>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="h-7 text-xs border-border-soft"
                >
                  <ArrowLeft className="w-3 h-3 mr-1" />
                  Edit Blueprint
                </Button>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleDownloadTemplate}
                    className="h-8 text-xs bg-white dark:bg-[#1E1E24] border-border-soft"
                  >
                    <Download className="w-3.5 h-3.5 mr-1 text-gray-500" />
                    Download Sample Template
                  </Button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 text-xs bg-white dark:bg-[#1E1E24] border-border-soft text-maroon hover:bg-maroon hover:text-white"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                    Upload CSV / Excel
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void runValidation()}
                    disabled={validating}
                    className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
                  >
                    {validating ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                    Verify Students
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleAddRow}
                    className="h-8 text-xs text-gray-body hover:text-ink"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add Row
                  </Button>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 bg-cream/40 dark:bg-neutral-900/50 p-0.5 rounded-lg border border-border-soft dark:border-neutral-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setRowStatusFilter('ALL')}
                    className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                      rowStatusFilter === 'ALL'
                        ? 'bg-white dark:bg-[#1E1E24] text-ink dark:text-neutral-100 shadow-xs'
                        : 'text-gray-body dark:text-neutral-400'
                    }`}
                  >
                    All ({rows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRowStatusFilter('VALID')}
                    className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                      rowStatusFilter === 'VALID'
                        ? 'bg-white dark:bg-[#1E1E24] text-emerald-700 shadow-xs'
                        : 'text-gray-body dark:text-neutral-400'
                    }`}
                  >
                    Valid ({rows.filter(r => r.matched && (!r.errors || r.errors.length === 0)).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRowStatusFilter('ISSUES')}
                    className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                      rowStatusFilter === 'ISSUES'
                        ? 'bg-white dark:bg-[#1E1E24] text-red-600 shadow-xs'
                        : 'text-gray-body dark:text-neutral-400'
                    }`}
                  >
                    Issues ({rows.filter(r => r.matched === false || (r.errors && r.errors.length > 0)).length})
                  </button>
                </div>
              </div>

              {/* Student Marks Table with Solid Sticky Header */}
              <div className="border border-border-soft dark:border-neutral-800 rounded-xl overflow-x-auto overflow-y-auto max-h-[50vh] bg-white dark:bg-[#1A1A1E]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-neutral-800 border-b border-border-soft dark:border-neutral-700 shadow-xs">
                    <tr>
                      <th className="py-3 px-3 w-12 text-center text-gray-body dark:text-neutral-400 font-bold bg-slate-100 dark:bg-neutral-800">
                        #
                      </th>
                      <th className="py-3 px-3 min-w-[170px] text-ink dark:text-neutral-200 font-bold bg-slate-100 dark:bg-neutral-800">
                        Roll No / Student Email
                      </th>
                      <th className="py-3 px-3 min-w-[150px] text-ink dark:text-neutral-200 font-bold bg-slate-100 dark:bg-neutral-800">
                        Matched Student
                      </th>
                      {mode === 'QUESTION_WISE' ? (
                        questions.map(q => (
                          <th
                            key={q.questionNumber}
                            className="py-3 px-2 w-24 text-center font-bold text-ink dark:text-neutral-200 bg-slate-100 dark:bg-neutral-800 whitespace-nowrap"
                          >
                            <div>Q{q.questionNumber}</div>
                            <div className="text-[10px] text-gray-500 font-normal">Max {q.maxMarks}m</div>
                          </th>
                        ))
                      ) : (
                        <th className="py-3 px-3 w-36 text-center font-bold text-ink dark:text-neutral-200 bg-slate-100 dark:bg-neutral-800">
                          Total Marks (Max {activeTotalMarks})
                        </th>
                      )}
                      <th className="py-3 px-3 w-20 text-center font-bold text-ink dark:text-neutral-200 bg-slate-100 dark:bg-neutral-800">
                        TOTAL
                      </th>
                      <th className="py-3 px-3 w-24 text-center font-bold text-ink dark:text-neutral-200 bg-slate-100 dark:bg-neutral-800">
                        BAND
                      </th>
                      <th className="py-3 px-3 w-28 text-center font-bold text-ink dark:text-neutral-200 bg-slate-100 dark:bg-neutral-800">
                        STATUS
                      </th>
                      <th className="py-3 px-2 w-12 text-center text-gray-body dark:text-neutral-400 bg-slate-100 dark:bg-neutral-800"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-soft dark:divide-neutral-800">
                    {displayedRows.length === 0 ? (
                      <tr>
                        <td colSpan={mode === 'QUESTION_WISE' ? questions.length + 6 : 7} className="py-12 text-center text-gray-400 text-xs">
                          No student rows match the selected filter.
                        </td>
                      </tr>
                    ) : (
                      displayedRows.map((row, idx) => {
                        // Calculate row total score
                        let calculatedRowScore = 0;
                        if (mode === 'QUESTION_WISE') {
                          questions.forEach(q => {
                            const val = Number(row.questionScores?.[String(q.questionNumber)] ?? 0);
                            if (!isNaN(val)) calculatedRowScore += val;
                          });
                        } else {
                          calculatedRowScore = Number(row.totalScore) || 0;
                        }

                        const percentage = activeTotalMarks > 0 ? Math.round((calculatedRowScore / activeTotalMarks) * 100) : 0;
                        const band = percentage >= 80 ? 'EXCELLENT' : percentage >= 60 ? 'AVERAGE' : 'POOR';
                        const hasErrors = Boolean(row.errors && row.errors.length > 0);
                        const isMatched = row.matched === true;

                        return (
                          <tr
                            key={row.id}
                            className={`transition-colors ${
                              hasErrors
                                ? 'bg-red-50/40 dark:bg-red-950/20'
                                : isMatched
                                ? 'bg-emerald-50/20 dark:bg-emerald-950/10'
                                : 'hover:bg-cream/20 dark:hover:bg-neutral-800/30'
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center text-gray-400 font-mono text-xs">
                              {idx + 1}
                            </td>

                            {/* Identifier Input */}
                            <td className="py-2.5 px-3">
                              <Input
                                placeholder="Roll No or Email"
                                value={row.identifier}
                                onChange={e => {
                                  const val = e.target.value;
                                  setRows(prev =>
                                    prev.map(r => (r.id === row.id ? { ...r, identifier: val, matched: undefined, errors: undefined } : r))
                                  );
                                }}
                                className={`h-8 text-xs font-mono ${
                                  hasErrors
                                    ? 'border-red-400 focus:border-red-500'
                                    : isMatched
                                    ? 'border-emerald-400'
                                    : ''
                                }`}
                              />
                            </td>

                            {/* Matched Student verification */}
                            <td className="py-2.5 px-3">
                              {row.matchedStudentName ? (
                                <div className="text-xs">
                                  <div className="font-bold text-ink dark:text-neutral-200">{row.matchedStudentName}</div>
                                  <div className="text-[10px] text-gray-400 font-mono">{row.matchedRollNumber}</div>
                                </div>
                              ) : row.matched === false ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400">
                                  <AlertTriangle className="w-3 h-3" /> Not Found
                                </span>
                              ) : (
                                <span className="text-[11px] text-gray-400 italic">Unverified</span>
                              )}
                            </td>

                            {/* Scores */}
                            {mode === 'QUESTION_WISE' ? (
                              questions.map(q => {
                                const scoreVal = row.questionScores?.[String(q.questionNumber)] ?? '';
                                const numVal = Number(scoreVal);
                                const isOverMax = !isNaN(numVal) && numVal > q.maxMarks;

                                return (
                                  <td key={q.questionNumber} className="py-2.5 px-2 text-center">
                                    <Input
                                      type="number"
                                      min={0}
                                      max={q.maxMarks}
                                      step="any"
                                      value={scoreVal}
                                      onChange={e => handleUpdateRowScore(row.id, q.questionNumber, e.target.value)}
                                      className={`h-8 text-xs text-center font-bold w-18 mx-auto ${
                                        isOverMax ? 'border-red-500 text-red-600 ring-1 ring-red-500' : ''
                                      }`}
                                    />
                                  </td>
                                );
                              })
                            ) : (
                              <td className="py-2.5 px-3 text-center">
                                <Input
                                  type="number"
                                  min={0}
                                  max={activeTotalMarks}
                                  step="any"
                                  value={row.totalScore ?? ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setRows(prev => prev.map(r => (r.id === row.id ? { ...r, totalScore: val } : r)));
                                  }}
                                  className="h-8 text-xs text-center font-bold w-24 mx-auto"
                                />
                              </td>
                            )}

                            {/* Auto Total Score */}
                            <td className="py-2.5 px-3 text-center font-bold text-xs font-mono text-ink dark:text-neutral-200">
                              {calculatedRowScore}
                            </td>

                            {/* Performance Band */}
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  band === 'EXCELLENT'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : band === 'AVERAGE'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {band}
                              </span>
                            </td>

                            {/* Validation Status Badge */}
                            <td className="py-2.5 px-3 text-center">
                              {hasErrors ? (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full cursor-help"
                                  title={row.errors?.join('\n')}
                                >
                                  <AlertCircle className="w-3 h-3" /> Error
                                </span>
                              ) : isMatched ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                  <Check className="w-3 h-3" /> Matched
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-400">Ready</span>
                              )}
                            </td>

                            {/* Action: Delete Row */}
                            <td className="py-2.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveRow(row.id)}
                                className="text-gray-300 hover:text-red-500 transition-colors p-1"
                                title="Remove row"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer */}
        <div className="p-4 sm:p-5 border-t border-border-soft dark:border-neutral-800 flex items-center justify-between gap-4 bg-slate-50/70 dark:bg-neutral-900/40">
          {step === 1 ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs h-9">
                Cancel
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleProceedToStep2}
                className="text-xs h-9 bg-maroon hover:bg-maroon-deep text-white font-bold px-4"
              >
                Continue to Step 2: Upload Marks
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="text-xs h-9"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  Back to Blueprint
                </Button>

                {validationSummary && (
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      validationSummary.readyToImport
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {validationSummary.readyToImport
                      ? `✓ All ${validationSummary.validRowsCount} students verified`
                      : `${validationSummary.validRowsCount} verified, ${validationSummary.invalidRowsCount} with issues`}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs h-9">
                  Cancel
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleImportSubmit}
                  disabled={
                    importing ||
                    validating ||
                    rows.filter(r => r.identifier.trim().length > 0).length === 0 ||
                    (validationSummary !== null && validationSummary.invalidRowsCount > 0)
                  }
                  className="text-xs h-9 bg-maroon hover:bg-maroon-deep text-white font-bold px-5 shadow-sm"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Importing Marks...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                      Import Marksheet
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfflineMarksheetModal;
