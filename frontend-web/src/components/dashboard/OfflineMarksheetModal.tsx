import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  Plus,
  Trash2,
  Download,
  Sparkles,
  Info,
  Loader2
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

interface OfflineMarksheetModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (newQuizId: string) => void;
  availableClasses?: Array<{ id: string; label: string; departmentId?: string; sectionId?: string }>;
  suggestedTopics?: string[];
}

export const OfflineMarksheetModal: React.FC<OfflineMarksheetModalProps> = ({
  open,
  onClose,
  onSuccess,
  availableClasses = [],
  suggestedTopics = []
}) => {
  const [mode, setMode] = useState<'QUESTION_WISE' | 'TOTAL_ONLY'>('QUESTION_WISE');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [totalMarksB, setTotalMarksB] = useState<number>(50);
  const [answersPublished, setAnswersPublished] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');

  // Mode A: Questions
  const [questions, setQuestions] = useState<QuestionDef[]>([
    { questionNumber: 1, topic: 'Core Concepts', maxMarks: 5 },
    { questionNumber: 2, topic: 'Problem Solving', maxMarks: 10 }
  ]);
  const [rawBlueprintText, setRawBlueprintText] = useState('');
  const [showBlueprintParser, setShowBlueprintParser] = useState(false);

  // Mode B: Overall Topic Tags
  const [overallTopics, setOverallTopics] = useState<string[]>(['General']);
  const [topicInput, setTopicInput] = useState('');

  // Marksheet rows
  const [rows, setRows] = useState<MarksheetRow[]>([
    { id: '1', identifier: '', studentName: '', questionScores: { '1': '', '2': '' }, totalScore: '' }
  ]);

  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [validationSummary, setValidationSummary] = useState<{
    validRowsCount: number;
    invalidRowsCount: number;
    totalRows: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Calculate Mode A total marks
  const computedTotalMarksA = useMemo(() => {
    return questions.reduce((sum, q) => sum + (Number(q.maxMarks) || 0), 0);
  }, [questions]);

  const activeTotalMarks = mode === 'QUESTION_WISE' ? computedTotalMarksA : (Number(totalMarksB) || 50);

  // Reset state on open
  useEffect(() => {
    if (open) {
      setTitle('');
      setSubject('');
      setRows([{ id: '1', identifier: '', studentName: '', questionScores: { '1': '', '2': '' }, totalScore: '' }]);
      setValidationSummary(null);
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

  if (!open) return null;

  // Add a question in Mode A
  const handleAddQuestion = () => {
    const nextNum = questions.length > 0 ? Math.max(...questions.map(q => q.questionNumber)) + 1 : 1;
    setQuestions([...questions, { questionNumber: nextNum, topic: 'Topic ' + nextNum, maxMarks: 5 }]);
  };

  const handleRemoveQuestion = (idx: number) => {
    if (questions.length <= 1) {
      toast.error('At least one question is required.');
      return;
    }
    const filtered = questions.filter((_, i) => i !== idx);
    setQuestions(filtered);
  };

  const handleUpdateQuestion = (idx: number, field: keyof QuestionDef, val: any) => {
    const updated = [...questions];
    updated[idx] = { ...updated[idx], [field]: val };
    setQuestions(updated);
  };

  // Quick Parse Blueprint from pasted text
  const handleParseBlueprintText = () => {
    if (!rawBlueprintText.trim()) return;
    const lines = rawBlueprintText.split(/\r?\n/).filter(l => l.trim().length > 0);
    const parsedQuestions: QuestionDef[] = [];

    lines.forEach((line, index) => {
      // Parse formats like:
      // Q1, Topic, 5
      // 1. Topic (10 marks)
      // Q1 - 5 marks - Topic
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
      toast.success(`Parsed ${parsedQuestions.length} questions successfully!`);
    } else {
      toast.error('Could not parse question structure. Please use format: Q1, Topic, Marks');
    }
  };

  // Add Overall Topic in Mode B
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

  // Add / Remove mark row
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

  // Handle file upload (CSV or XLSX)
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
        // XLSX/XLS: send to parse-file endpoint
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

  // Run server validation on current rows
  const runValidation = async (rowsToValidate: MarksheetRow[] = rows) => {
    const cleanRows = rowsToValidate.filter(r => r.identifier.trim().length > 0);
    if (cleanRows.length === 0) {
      toast.error('Please enter at least one student roll number or email.');
      return;
    }

    setValidating(true);
    try {
      const selectedClass = availableClasses.find(c => c.id === selectedClassId);
      const res = await apiClient.fetch('/api/v1/faculty/quiz/offline-marksheet/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          totalMarks: activeTotalMarks,
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

        // Update rows with student match info and errors
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
          toast.success(`Validated: All ${data.data.summary.validRowsCount} students verified!`);
        } else {
          toast.warning(`Validated: ${data.data.summary.validRowsCount} verified, ${data.data.summary.invalidRowsCount} issues need attention.`);
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
      return;
    }

    const cleanRows = rows.filter(r => r.identifier.trim().length > 0);
    if (cleanRows.length === 0) {
      toast.error('No student marks to import.');
      return;
    }

    setImporting(true);
    try {
      const selectedClass = availableClasses.find(c => c.id === selectedClassId);
      const res = await apiClient.fetch('/api/v1/faculty/quiz/offline-marksheet/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          subject: subject.trim() || undefined,
          mode,
          totalMarks: activeTotalMarks,
          answersPublished,
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
        toast.error(data.message || 'Failed to import offline marksheet.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Import error: ' + (err.message || 'Network error'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white dark:bg-[#18181B] rounded-2xl border border-border-soft shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-border-soft flex items-start justify-between gap-4 bg-cream/30 dark:bg-white/[0.02]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-maroon/10 text-maroon flex items-center justify-center font-bold text-sm">
                📝
              </span>
              <h2 className="text-xl font-serif font-bold text-ink">Import External Marksheet</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wide">
                Offline Quiz
              </span>
            </div>
            <p className="text-xs text-gray-body mt-1">
              Add marks for offline classroom tests or paper exams. Preserves topic-wise performance reports.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-body hover:text-ink hover:bg-cream/60 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Mode Switcher */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-ink">Select Import Mode</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('QUESTION_WISE')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  mode === 'QUESTION_WISE'
                    ? 'border-maroon bg-maroon/5 ring-1 ring-maroon'
                    : 'border-border-soft hover:bg-cream/30 bg-white dark:bg-[#1E1E22]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-ink flex items-center gap-1.5">
                    Mode A: Question-Wise
                    {mode === 'QUESTION_WISE' && <CheckCircle2 className="w-4 h-4 text-maroon" />}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Full Topic Analytics
                  </span>
                </div>
                <p className="text-xs text-gray-body">
                  Define questions & map each to a topic. Feeds directly into student topic accuracy & mastery trends.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('TOTAL_ONLY')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                  mode === 'TOTAL_ONLY'
                    ? 'border-maroon bg-maroon/5 ring-1 ring-maroon'
                    : 'border-border-soft hover:bg-cream/30 bg-white dark:bg-[#1E1E22]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-ink flex items-center gap-1.5">
                    Mode B: Total Score Only
                    {mode === 'TOTAL_ONLY' && <CheckCircle2 className="w-4 h-4 text-maroon" />}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                    Quick Fallback
                  </span>
                </div>
                <p className="text-xs text-gray-body">
                  Quickly upload final marks without question breakdowns. Feeds subject & overall student averages.
                </p>
              </button>
            </div>
          </div>

          {/* Assessment Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="quiz-title" className="text-xs font-semibold text-ink">Quiz Title *</Label>
              <Input
                id="quiz-title"
                placeholder="e.g. Unit Test 2 - Dynamic Programming"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="text-xs bg-white dark:bg-[#1E1E22] border-border-soft"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="quiz-subject" className="text-xs font-semibold text-ink">Subject / Course</Label>
              <Input
                id="quiz-subject"
                placeholder="e.g. Data Structures & Algorithms"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="text-xs bg-white dark:bg-[#1E1E22] border-border-soft"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-ink">Target Class</Label>
              <select
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-border-soft text-xs bg-white dark:bg-[#1E1E22] text-ink focus:outline-none focus:ring-1 focus:ring-maroon"
              >
                <option value="ALL">All Assigned Classes</option>
                {availableClasses.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mode A: Question-to-Topic Blueprint Setup */}
          {mode === 'QUESTION_WISE' && (
            <div className="space-y-3 p-4 rounded-xl border border-border-soft bg-cream/20 dark:bg-white/[0.01]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-serif font-bold text-sm text-ink flex items-center gap-2">
                    Question-to-Topic Blueprint
                    <span className="text-xs font-normal text-maroon font-mono font-bold">
                      (Total: {computedTotalMarksA} Marks)
                    </span>
                  </h3>
                  <p className="text-[11px] text-gray-body">
                    Specify max marks and topic tag for each question.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBlueprintParser(!showBlueprintParser)}
                    className="text-xs h-7 border-border-soft text-gray-body hover:text-ink"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1 text-maroon" />
                    {showBlueprintParser ? 'Close Quick Parser' : 'Paste Blueprint'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddQuestion}
                    className="text-xs h-7 border-maroon text-maroon hover:bg-maroon hover:text-white"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Question
                  </Button>
                </div>
              </div>

              {/* Quick Parser Drawer */}
              {showBlueprintParser && (
                <div className="p-3 bg-white dark:bg-[#18181B] border border-maroon/20 rounded-xl space-y-2 animate-in fade-in duration-100">
                  <Label className="text-[11px] font-semibold text-ink">
                    Paste lines like: <code className="text-maroon">Q1, Trees, 5</code> or <code className="text-maroon">1. Recursion (10 marks)</code>
                  </Label>
                  <textarea
                    rows={3}
                    value={rawBlueprintText}
                    onChange={e => setRawBlueprintText(e.target.value)}
                    placeholder="Q1, Arrays, 5&#10;Q2, Trees, 10&#10;Q3, Graph Algorithms, 15"
                    className="w-full text-xs font-mono p-2.5 border border-border-soft rounded-lg bg-cream/20 dark:bg-[#1E1E22] focus:outline-none focus:ring-1 focus:ring-maroon resize-none text-ink"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleParseBlueprintText}
                      className="text-xs h-7 bg-maroon hover:bg-maroon-deep text-white"
                    >
                      Apply Parsed Questions
                    </Button>
                  </div>
                </div>
              )}

              {/* Dynamic Questions Table */}
              <div className="overflow-x-auto max-h-52 border border-border-soft rounded-lg bg-white dark:bg-[#1E1E22]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-cream/40 dark:bg-white/[0.03] border-b border-border-soft text-gray-body uppercase text-[10px] tracking-wider sticky top-0">
                    <tr>
                      <th className="p-2.5 w-16 text-center">Q#</th>
                      <th className="p-2.5">Topic Tag *</th>
                      <th className="p-2.5 w-28">Max Marks *</th>
                      <th className="p-2.5">Description (Optional)</th>
                      <th className="p-2.5 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-soft">
                    {questions.map((q, idx) => (
                      <tr key={idx} className="hover:bg-cream/10">
                        <td className="p-2 text-center font-bold font-mono text-ink">
                          Q{q.questionNumber}
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={q.topic}
                            list="suggested-topics-list"
                            onChange={e => handleUpdateQuestion(idx, 'topic', e.target.value)}
                            placeholder="e.g. Arrays, Trees, OOP"
                            className="w-full px-2 py-1 text-xs border border-border-soft rounded bg-white dark:bg-[#18181B] text-ink focus:outline-none focus:border-maroon"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="1"
                            step="0.5"
                            value={q.maxMarks}
                            onChange={e => handleUpdateQuestion(idx, 'maxMarks', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-xs font-mono font-bold border border-border-soft rounded bg-white dark:bg-[#18181B] text-ink focus:outline-none focus:border-maroon"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={q.questionText || ''}
                            onChange={e => handleUpdateQuestion(idx, 'questionText', e.target.value)}
                            placeholder="Optional brief question label"
                            className="w-full px-2 py-1 text-xs border border-border-soft rounded bg-white dark:bg-[#18181B] text-ink focus:outline-none focus:border-maroon"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(idx)}
                            className="text-gray-body hover:text-red-600 transition-colors p-1"
                            title="Remove Question"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <datalist id="suggested-topics-list">
                {suggestedTopics.map((topic, i) => (
                  <option key={i} value={topic} />
                ))}
              </datalist>
            </div>
          )}

          {/* Mode B: Total Marks & Overall Topics */}
          {mode === 'TOTAL_ONLY' && (
            <div className="space-y-3 p-4 rounded-xl border border-border-soft bg-cream/20 dark:bg-white/[0.01]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="max-marks-b" className="text-xs font-semibold text-ink">
                    Maximum Quiz Marks *
                  </Label>
                  <Input
                    id="max-marks-b"
                    type="number"
                    min="1"
                    value={totalMarksB}
                    onChange={e => setTotalMarksB(Math.max(1, parseFloat(e.target.value) || 0))}
                    className="text-xs font-mono font-bold bg-white dark:bg-[#1E1E22] border-border-soft"
                  />
                  <p className="text-[11px] text-gray-body">Student obtained marks will be scored out of this total.</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-ink">Overall Topics Covered</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. Data Structures"
                      value={topicInput}
                      onChange={e => setTopicInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTopic();
                        }
                      }}
                      className="text-xs bg-white dark:bg-[#1E1E22] border-border-soft"
                    />
                    <Button type="button" size="sm" onClick={handleAddTopic} variant="outline" className="text-xs border-border-soft">
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {overallTopics.map((t, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-maroon/10 text-maroon border border-maroon/20"
                      >
                        {t}
                        <button type="button" onClick={() => handleRemoveTopic(t)} className="hover:text-red-700">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Marksheet Upload / Entry Section */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-serif font-bold text-sm text-ink flex items-center gap-2">
                  Student Marks Entry
                  <span className="text-xs font-normal text-gray-body">
                    ({rows.filter(r => r.identifier.trim().length > 0).length} student rows)
                  </span>
                </h3>
                <p className="text-[11px] text-gray-body">
                  Upload a spreadsheet, download our pre-filled template, or edit entries directly below.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  className="text-xs h-8 border-border-soft text-gray-body hover:text-maroon hover:border-maroon/40"
                  title="Download pre-filled CSV sample template"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Download Sample CSV
                </Button>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs h-8 bg-cream/40 border-maroon/30 text-maroon hover:bg-maroon hover:text-white"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                  Upload CSV / Excel
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => void runValidation()}
                  disabled={validating}
                  className="text-xs h-8 bg-emerald-700 hover:bg-emerald-800 text-white"
                >
                  {validating ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                  Verify Students
                </Button>
              </div>
            </div>

            {/* Validation Banner if validated */}
            {validationSummary && (
              <div
                className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
                  validationSummary.invalidRowsCount === 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 text-emerald-800 dark:text-emerald-300'
                    : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 text-amber-800 dark:text-amber-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {validationSummary.invalidRowsCount === 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <span>
                    <strong>{validationSummary.validRowsCount}</strong> matched students ready to import.
                    {validationSummary.invalidRowsCount > 0 && (
                      <span className="ml-1 text-red-600 dark:text-red-400 font-bold">
                        ({validationSummary.invalidRowsCount} unmatched or invalid rows flagged below)
                      </span>
                    )}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddRow}
                  className="text-xs h-6 px-2 text-ink"
                >
                  + Add Row Manually
                </Button>
              </div>
            )}

            {/* Editable Interactive Table */}
            <div className="overflow-x-auto max-h-64 border border-border-soft rounded-xl bg-white dark:bg-[#1E1E22]">
              <table className="w-full text-left text-xs">
                <thead className="bg-cream/40 dark:bg-white/[0.03] border-b border-border-soft text-gray-body uppercase text-[10px] tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="p-2.5 w-10 text-center">#</th>
                    <th className="p-2.5 w-40">Roll No / Email *</th>
                    <th className="p-2.5 w-36">Student Name</th>
                    {mode === 'QUESTION_WISE' ? (
                      questions.map(q => (
                        <th key={q.questionNumber} className="p-2 text-center min-w-[70px]">
                          Q{q.questionNumber} <span className="text-[9px] text-gray-body font-normal">({q.maxMarks}m)</span>
                        </th>
                      ))
                    ) : (
                      <th className="p-2 text-center w-28">Obtained Marks *</th>
                    )}
                    <th className="p-2 text-center w-24">Total / Band</th>
                    <th className="p-2.5 w-44">Status / Match</th>
                    <th className="p-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {rows.map((row, index) => {
                    const rowScores = row.questionScores || {};
                    let calculatedSum = 0;
                    if (mode === 'QUESTION_WISE') {
                      questions.forEach(q => {
                        calculatedSum += parseFloat(String(rowScores[String(q.questionNumber)] || 0)) || 0;
                      });
                    } else {
                      calculatedSum = parseFloat(String(row.totalScore || 0)) || 0;
                    }
                    const pct = activeTotalMarks > 0 ? Math.round((calculatedSum / activeTotalMarks) * 100) : 0;
                    const band = pct >= 80 ? 'EXCELLENT' : pct >= 60 ? 'AVERAGE' : 'POOR';

                    return (
                      <tr
                        key={row.id}
                        className={`hover:bg-cream/10 transition-colors ${
                          row.errors && row.errors.length > 0 ? 'bg-red-50/40 dark:bg-red-950/10' : ''
                        }`}
                      >
                        <td className="p-2 text-center text-gray-body font-mono text-[11px]">{index + 1}</td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={row.identifier}
                            onChange={e => {
                              const val = e.target.value;
                              setRows(rows.map(r => (r.id === row.id ? { ...r, identifier: val, errors: undefined } : r)));
                            }}
                            placeholder="e.g. 21CS042"
                            className="w-full px-2 py-1 text-xs border border-border-soft rounded bg-white dark:bg-[#18181B] text-ink focus:outline-none focus:border-maroon font-mono"
                          />
                        </td>
                        <td className="p-1.5">
                          <span className="text-ink font-semibold truncate block max-w-[140px]" title={row.matchedStudentName || row.studentName}>
                            {row.matchedStudentName || row.studentName || '—'}
                          </span>
                        </td>

                        {mode === 'QUESTION_WISE' ? (
                          questions.map(q => (
                            <td key={q.questionNumber} className="p-1.5 text-center">
                              <input
                                type="number"
                                min="0"
                                max={q.maxMarks}
                                step="0.5"
                                value={rowScores[String(q.questionNumber)] ?? ''}
                                onChange={e => handleUpdateRowScore(row.id, q.questionNumber, e.target.value)}
                                className={`w-14 text-center px-1.5 py-1 text-xs font-mono font-bold border rounded bg-white dark:bg-[#18181B] focus:outline-none ${
                                  parseFloat(String(rowScores[String(q.questionNumber)])) > q.maxMarks
                                    ? 'border-red-500 text-red-600 bg-red-50'
                                    : 'border-border-soft text-ink focus:border-maroon'
                                }`}
                              />
                            </td>
                          ))
                        ) : (
                          <td className="p-1.5 text-center">
                            <input
                              type="number"
                              min="0"
                              max={activeTotalMarks}
                              step="0.5"
                              value={row.totalScore ?? ''}
                              onChange={e => {
                                const val = e.target.value;
                                setRows(rows.map(r => (r.id === row.id ? { ...r, totalScore: val, errors: undefined } : r)));
                              }}
                              className={`w-20 text-center px-2 py-1 text-xs font-mono font-bold border rounded bg-white dark:bg-[#18181B] focus:outline-none ${
                                parseFloat(String(row.totalScore)) > activeTotalMarks
                                  ? 'border-red-500 text-red-600 bg-red-50'
                                  : 'border-border-soft text-ink focus:border-maroon'
                              }`}
                            />
                          </td>
                        )}

                        <td className="p-1.5 text-center font-mono">
                          <div className="font-bold text-ink">{calculatedSum} <span className="text-[10px] text-gray-body font-normal">({pct}%)</span></div>
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              band === 'EXCELLENT'
                                ? 'bg-green-100 text-green-800'
                                : band === 'AVERAGE'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {band}
                          </span>
                        </td>

                        <td className="p-1.5 text-xs">
                          {row.matched ? (
                            <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{row.matchedStudentName}</span>
                            </div>
                          ) : row.errors && row.errors.length > 0 ? (
                            <div className="flex items-center gap-1 text-red-600 dark:text-red-400 text-[11px]" title={row.errors.join('; ')}>
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{row.errors[0]}</span>
                            </div>
                          ) : (
                            <span className="text-gray-body text-[11px] italic">Not verified yet</span>
                          )}
                        </td>

                        <td className="p-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.id)}
                            className="text-gray-body hover:text-red-600 transition-colors p-1"
                            title="Remove Row"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddRow}
                className="text-xs h-7 text-maroon hover:bg-maroon/5 font-semibold"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Student Row
              </Button>

              <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
                <input
                  type="checkbox"
                  checked={answersPublished}
                  onChange={e => setAnswersPublished(e.target.checked)}
                  className="rounded border-border-soft text-maroon focus:ring-maroon accent-maroon w-4 h-4"
                />
                <span className="text-ink font-medium">Publish marks immediately to student dashboards</span>
              </label>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-border-soft flex items-center justify-between gap-3 bg-cream/20 dark:bg-white/[0.02]">
          <div className="flex items-center gap-1.5 text-xs text-gray-body">
            <Info className="w-4 h-4 text-maroon shrink-0" />
            <span>External offline marks will be aggregated into student topic mastery and overall performance.</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={importing}
              className="text-xs font-semibold border-border-soft"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleImportSubmit}
              disabled={importing || rows.filter(r => r.identifier.trim()).length === 0}
              className="text-xs font-bold bg-maroon hover:bg-maroon-deep text-white px-5 shadow-sm"
            >
              {importing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Importing Marksheet...
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                  Import Marksheet ({rows.filter(r => r.identifier.trim()).length} Students)
                </>
              )}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};
export default OfflineMarksheetModal;
