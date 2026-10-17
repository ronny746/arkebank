'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  QuestionItem, 
  PaperMetadata, 
  PaperBlueprintConfig,
  SavedPaper,
} from '@/types/paper';
import MathRenderer from '../MathRenderer';
import PaperPrintableDocument from './PaperPrintableDocument';
import ExamCreatorModal from '../exams/ExamCreatorModal';
import { QUESTION_TYPE_OPTIONS, type QuestionType } from '@/lib/question-types';
import { 
  Sparkles, 
  Printer, 
  Save, 
  RotateCcw, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  RefreshCw, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Award, 
  Layers, 
  Sliders, 
  Eye, 
  ChevronRight, 
  Plus, 
  HelpCircle,
  Copy,
  BookOpen,
  Filter,
  Check,
  Search,
  Zap,
  Target,
  Stethoscope,
  GraduationCap,
  Settings2,
  Calendar,
  Pencil,
  ChevronDown,
  ChevronUp,
  Columns,
  LayoutList,
  Languages,
  ShieldCheck
} from 'lucide-react';

interface PaperGeneratorViewProps {
  classesList: string[];
  subjectsList: string[];
  topicsList: string[];
  onImageZoom: (url: string, title?: string) => void;
  showToast: (msg: string) => void;
  onNavigateToBank: () => void;
  initialPaper?: SavedPaper | null;
}

const compactQuestionText = (value?: string, limit = 260) => {
  const plain = String(value || '')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' [formula] ')
    .replace(/\$[^$]+\$/g, ' [formula] ')
    .replace(/\\\([\s\S]*?\\\)/g, ' [formula] ')
    .replace(/&nbsp;|&amp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > limit ? `${plain.slice(0, limit).trim()}…` : plain;
};

const dedupeQuestions = (questions: QuestionItem[]) => {
  const seen = new Set<string>();
  return questions.filter((question) => {
    const identity = String(question._id || question.id);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
};

type QuestionUsage = {
  paperId: string;
  title: string;
  updatedAt?: string;
};

export default function PaperGeneratorView({
  classesList,
  subjectsList,
  topicsList,
  onImageZoom,
  showToast,
  onNavigateToBank,
  initialPaper,
}: PaperGeneratorViewProps) {
  // Active Studio Tab: editor | preview (student paper) | solutions (teacher key)
  const [studioTab, setStudioTab] = useState<'editor' | 'preview' | 'solutions'>('editor');
  const [builderMode, setBuilderMode] = useState<'configure' | 'edit'>('configure');
  const [builderStep, setBuilderStep] = useState<1 | 2 | 3>(1);
  const [resetArmed, setResetArmed] = useState(false);

  // Paper Formatting Options
  const [optionFormat, setOptionFormat] = useState<'abcd' | '1234'>('abcd');
  const [columnsMode, setColumnsMode] = useState<'1-col' | '2-col'>('1-col');
  const [optionsLayout, setOptionsLayout] = useState<'2-col' | '4-col' | '1-col'>('2-col');

  // Generator Blueprint State
  const [selectedClass, setSelectedClass] = useState<string>(classesList[0] || 'Class 12');
  const [selectedSubject, setSelectedSubject] = useState<string>(subjectsList[0] || 'Physics');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([subjectsList[0] || 'Physics']);
  const [pickerSubject, setPickerSubject] = useState<string>(subjectsList[0] || 'Physics');
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [taxonomyLoading, setTaxonomyLoading] = useState<boolean>(true);
  const [taxonomyError, setTaxonomyError] = useState<string>('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [chapterSearch, setChapterSearch] = useState<string>('');
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [manualQuestionId, setManualQuestionId] = useState<string>('');
  const [addingQuestion, setAddingQuestion] = useState<boolean>(false);
  const [previewTopic, setPreviewTopic] = useState<string>('');
  const [topicPreviewQuestions, setTopicPreviewQuestions] = useState<QuestionItem[]>([]);
  const [checkedPreviewIds, setCheckedPreviewIds] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const topicScopeRef = useRef<string>('');
  const [totalQuestions, setTotalQuestions] = useState<number>(25);
  const [timeAllowed, setTimeAllowed] = useState<string>('60 Mins');
  const [examTitle, setExamTitle] = useState<string>('Comprehensive Assessment Test 2026');
  const [instituteName, setInstituteName] = useState<string>('ARKE SCHOLARS ACADEMY');
  const [marksPerQuestion, setMarksPerQuestion] = useState<number>(4);
  const [negativeMarks, setNegativeMarks] = useState<number>(1);
  const [selectedLang, setSelectedLang] = useState<'en' | 'hi'>('en');
  const [switchingLang, setSwitchingLang] = useState(false);
  const [pyqOnly, setPyqOnly] = useState<boolean>(false);
  const [hasImageOnly, setHasImageOnly] = useState<boolean>(false);
  const [questionType, setQuestionType] = useState<QuestionType>('all');
  const [availableQuestionTypes, setAvailableQuestionTypes] = useState<QuestionType[]>(['all']);

  const isMultiSubjectExam = ['NEET', 'JM', 'JA', 'JEE Main', 'JEE Advanced'].includes(selectedClass);
  const eligibleSubjects = useMemo(() => {
    if (selectedClass === 'NEET') return availableSubjects.filter(subject => ['Physics', 'Chemistry', 'Biology'].includes(subject));
    if (['JM', 'JA', 'JEE Main', 'JEE Advanced'].includes(selectedClass)) return availableSubjects.filter(subject => ['Physics', 'Chemistry', 'Mathematics'].includes(subject));
    return availableSubjects;
  }, [selectedClass, availableSubjects]);

  // Difficulty sliders (percentages)
  const [easyPct, setEasyPct] = useState<number>(30);
  const [medPct, setMedPct] = useState<number>(50);
  const [hardPct, setHardPct] = useState<number>(20);

  // Active Questions in Paper
  const [paperQuestions, setPaperQuestions] = useState<QuestionItem[]>([]);
  const [activePaperId, setActivePaperId] = useState<string | null>(null);
  const [activePaperCreatedAt, setActivePaperCreatedAt] = useState<string | null>(null);
  const [questionUsage, setQuestionUsage] = useState<Record<string, QuestionUsage[]>>({});
  const [instructions, setInstructions] = useState<string[]>([
    'All questions are compulsory.',
    'Each correct answer carries +4 marks.',
    'For each incorrect response, 1 mark will be deducted.',
    'Use of calculators or log tables is strictly prohibited.',
  ]);

  // Loading States
  const [generating, setGenerating] = useState<boolean>(false);
  const [swappingId, setSwappingId] = useState<string | number | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [examCreatorOpen, setExamCreatorOpen] = useState(false);

  // A library paper is fetched from MongoDB by SavedPapersView and passed
  // through React state. It is never staged in localStorage.
  useEffect(() => {
    if (!initialPaper?.id || !Array.isArray(initialPaper.questions)) return;
    setPaperQuestions(dedupeQuestions(initialPaper.questions));
    setActivePaperId(initialPaper.id);
    setActivePaperCreatedAt(initialPaper.createdAt || null);
    setExamTitle(initialPaper.title || 'Untitled paper');
    setInstituteName(initialPaper.instituteName || 'ARKE SCHOLARS ACADEMY');
    setTimeAllowed(initialPaper.timeAllowed || '60 Mins');
    setSelectedClass(initialPaper.class_std || 'all');
    setSelectedSubject(initialPaper.subject || 'all');
    setInstructions(initialPaper.instructions || []);
    setBuilderMode('edit');
    setStudioTab('editor');
  }, [initialPaper]);

  // Editing single question state via EditTaggingModal
  const [replacementIndex, setReplacementIndex] = useState<number | null>(null);
  const [openSolutions, setOpenSolutions] = useState<Record<string | number, boolean>>({});

  // A saved-paper lookup is deliberately separate from the question picker:
  // it adds a lightweight reuse warning without exposing other paper content.
  useEffect(() => {
    const questionIds = [...new Set(paperQuestions.map((question) => String(question._id || question.id)).filter(Boolean))];
    if (!questionIds.length) {
      setQuestionUsage({});
      return;
    }

    const controller = new AbortController();
    const loadQuestionUsage = async () => {
      try {
        const token = localStorage.getItem('arke_token');
        const response = await fetch('/api/paper/usage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify({ questionIds, excludePaperId: activePaperId }),
        });
        const data = await response.json();
        if (response.ok && data.success && !controller.signal.aborted) setQuestionUsage(data.usage || {});
      } catch (error) {
        if (!controller.signal.aborted) console.warn('Question reuse check unavailable', error);
      }
    };
    void loadQuestionUsage();
    return () => controller.abort();
  }, [paperQuestions, activePaperId]);

  // Load topics dynamically when class/subject changes
  useEffect(() => {
    const controller = new AbortController();
    async function fetchDynamicTopics() {
      setTaxonomyLoading(true);
      setTaxonomyError('');
      try {
        const token = localStorage.getItem('arke_token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(
          `/api/filters?class_std=${encodeURIComponent(selectedClass)}&subject=${encodeURIComponent(pickerSubject)}&lang=${selectedLang}&withQuestions=true`,
          { headers, credentials: 'include', signal: controller.signal }
        );
        if (!res.ok) throw new Error('Could not load available subjects and chapters.');
        if (res.ok) {
          const data = await res.json();
          if (controller.signal.aborted) return;
          if (Array.isArray(data.classes) && data.classes.length > 0) {
            setAvailableClasses(data.classes);
            if (!data.classes.includes(selectedClass)) setSelectedClass(data.classes[0]);
          }
          if (Array.isArray(data.subjects)) {
            setAvailableSubjects(data.subjects);
            const eligible = data.subjects as string[];
            const retainedSubjects = selectedSubjects.filter((subject) => eligible.includes(subject));
            const nextSubjects = retainedSubjects.length ? retainedSubjects : eligible.slice(0, isMultiSubjectExam ? eligible.length : 1);
            if (nextSubjects.length) {
              if (nextSubjects.join('|') !== selectedSubjects.join('|')) setSelectedSubjects(nextSubjects);
              setSelectedSubject(nextSubjects[0]);
              if (!nextSubjects.includes(pickerSubject)) setPickerSubject(nextSubjects[0]);
            }
          }
          if (Array.isArray(data.questionTypes)) {
            const nextTypes = data.questionTypes.filter((type: unknown): type is QuestionType =>
              QUESTION_TYPE_OPTIONS.some((option) => option.id === type),
            );
            setAvailableQuestionTypes(nextTypes.length ? nextTypes : ['all']);
            if (!nextTypes.includes(questionType)) setQuestionType('all');
          }
          setShowAllTopics(false);
          const nextScope = `${selectedClass}|${selectedLang}`;
          const scopeChanged = Boolean(topicScopeRef.current) && topicScopeRef.current !== nextScope;
          topicScopeRef.current = nextScope;

          if (scopeChanged) {
            // A class or language change creates a new blueprint. Switching the
            // subject tab must not silently throw away chapters picked earlier.
            setSelectedTopics([]);
            setPreviewTopic('');
            setTopicPreviewQuestions([]);
          }

          if (Array.isArray(data.topics) && data.topics.length > 0) {
            setAvailableTopics(data.topics);
          } else {
            setAvailableTopics([]);
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('Error fetching topics:', err);
          setTaxonomyError('Available subjects could not be loaded. Try again in a moment.');
        }
      } finally {
        if (!controller.signal.aborted) setTaxonomyLoading(false);
      }
    }
    void fetchDynamicTopics();
    return () => controller.abort();
  }, [pickerSubject, selectedClass, selectedLang, selectedSubjects, isMultiSubjectExam, questionType]);

  // Filtered topics based on search input
  const filteredTopics = useMemo(() => {
    if (!chapterSearch.trim()) return availableTopics;
    const term = chapterSearch.toLowerCase().trim();
    return availableTopics.filter((t) => t.toLowerCase().includes(term));
  }, [availableTopics, chapterSearch]);
  const visibleTopics = useMemo(() => chapterSearch.trim() || showAllTopics ? filteredTopics : filteredTopics.slice(0, 18), [chapterSearch, filteredTopics, showAllTopics]);

  // Apply Blueprint Presets
  const applyPreset = (preset: 'balanced' | 'foundation' | 'advanced' | 'jee_main' | 'neet' | 'cbse') => {
    if (preset === 'balanced') {
      setTotalQuestions(25);
      setTimeAllowed('60 Mins');
      setMarksPerQuestion(4);
      setNegativeMarks(1);
      setEasyPct(30);
      setMedPct(50);
      setHardPct(20);
      setExamTitle(`${selectedSubject} Balanced Assessment`);
    } else if (preset === 'foundation') {
      setTotalQuestions(20);
      setTimeAllowed('45 Mins');
      setMarksPerQuestion(3);
      setNegativeMarks(0);
      setEasyPct(60);
      setMedPct(40);
      setHardPct(0);
      setExamTitle(`${selectedSubject} Foundation Concept Test`);
    } else if (preset === 'advanced') {
      setTotalQuestions(30);
      setTimeAllowed('90 Mins');
      setMarksPerQuestion(4);
      setNegativeMarks(2);
      setEasyPct(15);
      setMedPct(45);
      setHardPct(40);
      setExamTitle(`${selectedSubject} Advanced Ranker Test`);
    } else if (preset === 'jee_main') {
      setTotalQuestions(25);
      setTimeAllowed('60 Mins');
      setMarksPerQuestion(4);
      setNegativeMarks(1);
      setEasyPct(25);
      setMedPct(50);
      setHardPct(25);
      setExamTitle(`JEE Main Pattern Assessment - ${selectedSubject}`);
    } else if (preset === 'neet') {
      setTotalQuestions(45);
      setTimeAllowed('45 Mins');
      setMarksPerQuestion(4);
      setNegativeMarks(1);
      setEasyPct(40);
      setMedPct(45);
      setHardPct(15);
      setExamTitle(`NEET Pattern Drill Mock - ${selectedSubject}`);
    } else if (preset === 'cbse') {
      setTotalQuestions(35);
      setTimeAllowed('180 Mins');
      setMarksPerQuestion(3);
      setNegativeMarks(0);
      setEasyPct(45);
      setMedPct(45);
      setHardPct(10);
      setExamTitle(`CBSE Board Pattern Mock - ${selectedSubject}`);
    }
    showToast(`Loaded ${preset.toUpperCase()} blueprint pattern.`);
  };

  const handleToggleTopic = (topicName: string) => {
    // A click always opens the chapter. Selection and removal are explicit
    // actions in the question pane, so an inspection click never removes work.
    setSelectedTopics((previous) => previous.includes(topicName) ? previous : [...previous, topicName]);
    setPreviewTopic(topicName);
  };

  const handleSelectAllTopics = () => setSelectedTopics([...availableTopics]);
  const handleClearAllTopics = () => { setSelectedTopics([]); setPreviewTopic(''); setTopicPreviewQuestions([]); };
  const handleSelectSubject = (subject: string) => {
    if (!isMultiSubjectExam) { setSelectedSubject(subject); setSelectedSubjects([subject]); setPickerSubject(subject); return; }
    setSelectedSubjects(previous => {
      const next = previous.includes(subject) ? previous.filter(item => item !== subject) : [...previous, subject];
      const resolved = next.length ? next : [subject];
      setSelectedSubject(resolved[0]);
      setPickerSubject(subject);
      return resolved;
    });
  };

  const openBalanceStep = () => {
    // In teacher-picked mode, the paper contains exactly the questions the
    // teacher reviewed. We never silently pad it with generated records.
    if (paperQuestions.length > 0) setTotalQuestions(paperQuestions.length);
    setBuilderStep(3);
  };

  const handleAddQuestionById = async () => {
    const questionId = manualQuestionId.trim();
    if (!questionId) return showToast('Enter a question ID to add it to this paper.');
    if (paperQuestions.length >= totalQuestions) return showToast(`This paper already has its target of ${totalQuestions} questions.`);
    setAddingQuestion(true);
    try {
      const token = localStorage.getItem('arke_token');
      const response = await fetch(`/api/questions/${encodeURIComponent(questionId)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' });
      const data = await response.json();
      if (!response.ok || !data.question) throw new Error(data.error || 'Question not found.');
      const candidate = data.question as QuestionItem;
      const candidateId = String(candidate._id || candidate.id);
      if (paperQuestions.some(question => String(question._id || question.id) === candidateId)) throw new Error('This question is already in the paper.');
      setPaperQuestions(previous => [...previous, { ...candidate, marks: Number(candidate.marks) || marksPerQuestion, negative_marks: Number(candidate.negative_marks) || negativeMarks }]);
      setManualQuestionId('');
      showToast(`Question #${candidate.id} added to the paper.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not add question.');
    } finally {
      setAddingQuestion(false);
    }
  };

  const handleAddPreviewQuestion = (candidate: QuestionItem) => {
    const candidateId = String(candidate._id || candidate.id);
    if (paperQuestions.some(question => String(question._id || question.id) === candidateId)) return showToast('This question is already in the paper.');
    if (replacementIndex !== null) {
      const currentQuestion = paperQuestions[replacementIndex];
      if (!currentQuestion) return;
      setPaperQuestions(previous => previous.map((question, index) => index === replacementIndex ? {
        ...candidate,
        marks: Number(currentQuestion.marks) || marksPerQuestion,
        negative_marks: Number(currentQuestion.negative_marks) || negativeMarks,
      } : question));
      setReplacementIndex(null);
      setBuilderMode('edit');
      setStudioTab('editor');
      showToast(`Question ${replacementIndex + 1} replaced with #${candidate.id}.`);
      return;
    }
    if (paperQuestions.length >= totalQuestions) return showToast(`This paper already has its target of ${totalQuestions} questions.`);
    setPaperQuestions(previous => [...previous, { ...candidate, marks: Number(candidate.marks) || marksPerQuestion, negative_marks: Number(candidate.negative_marks) || negativeMarks }]);
    showToast(`Question #${candidate.id} added. Paper now has ${paperQuestions.length + 1} questions.`);
  };

  const openChapterReplacementPicker = (index: number) => {
    const currentQuestion = paperQuestions[index];
    if (!currentQuestion) return;
    const chapter = currentQuestion.topic || selectedTopics[0] || '';
    setReplacementIndex(index);
    setBuilderMode('configure');
    setBuilderStep(2);
    if (chapter) {
      setSelectedTopics(previous => previous.includes(chapter) ? previous : [...previous, chapter]);
      setPreviewTopic(chapter);
    } else {
      setPreviewTopic('');
      setTopicPreviewQuestions([]);
    }
  };

  const handleAddVisibleTopicQuestions = () => {
    const existingIds = new Set(paperQuestions.map(question => String(question._id || question.id)));
    const remaining = Math.max(0, totalQuestions - paperQuestions.length);
    if (!remaining) return showToast(`This paper already has its target of ${totalQuestions} questions.`);
    const additions = topicPreviewQuestions
      .filter(question => !existingIds.has(String(question._id || question.id)))
      .slice(0, remaining)
      .map(question => ({
        ...question,
        marks: Number(question.marks) || marksPerQuestion,
        negative_marks: Number(question.negative_marks) || negativeMarks,
      }));

    if (!additions.length) return showToast('All visible questions from this chapter are already in the paper.');
    setPaperQuestions(previous => [...previous, ...additions]);
    showToast(`${additions.length} questions from ${previewTopic} added. ${Math.max(0, totalQuestions - paperQuestions.length - additions.length)} slots remain.`);
  };

  const handleAddCheckedPreviewQuestions = () => {
    const remaining = Math.max(0, totalQuestions - paperQuestions.length);
    if (!remaining) return showToast(`This paper already has its target of ${totalQuestions} questions.`);
    const existingIds = new Set(paperQuestions.map(question => String(question._id || question.id)));
    const additions = topicPreviewQuestions
      .filter(question => checkedPreviewIds.includes(String(question._id || question.id)) && !existingIds.has(String(question._id || question.id)))
      .slice(0, remaining)
      .map(question => ({ ...question, marks: Number(question.marks) || marksPerQuestion, negative_marks: Number(question.negative_marks) || negativeMarks }));
    if (!additions.length) return showToast('Tick one or more new questions first.');
    setPaperQuestions(previous => [...previous, ...additions]);
    setCheckedPreviewIds([]);
    showToast(`${additions.length} selected questions added to the paper.`);
  };

  const handleFillFromPreviewTopic = async () => {
    if (!previewTopic) return;
    const remaining = Math.max(1, totalQuestions - paperQuestions.length);
    setGenerating(true);
    try {
      const token = localStorage.getItem('arke_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch('/api/paper/generate', {
        method: 'POST', headers, credentials: 'include',
        body: JSON.stringify({
          class_std: selectedClass, subject: pickerSubject, subjects: selectedSubjects,
          topics: [previewTopic], totalQuestions: remaining, lang: selectedLang,
          difficultyDistribution: { easy: easyPct, medium: medPct, hard: hardPct },
          hasImageOnly, pyqOnly, questionType, marksPerQuestion, negativeMarks,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not add questions from this chapter.');
      const existingIds = new Set(paperQuestions.map(question => String(question._id || question.id)));
      const additions = (data.questions || []).filter((question: QuestionItem) => !existingIds.has(String(question._id || question.id)));
      if (!additions.length) throw new Error('No new questions were found in this chapter.');
      setPaperQuestions(previous => [...previous, ...additions]);
      showToast(`${additions.length} questions from ${previewTopic} added to the paper.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not add questions from this chapter.');
    } finally { setGenerating(false); }
  };

  const handleRemovePreviewTopicQuestions = () => {
    if (!previewTopic) return;
    const before = paperQuestions.length;
    const remainingQuestions = paperQuestions.filter(question => question.topic !== previewTopic);
    const removed = before - remainingQuestions.length;
    if (removed) setPaperQuestions(remainingQuestions);
    setSelectedTopics(previous => previous.filter(topic => topic !== previewTopic));
    setCheckedPreviewIds([]);
    showToast(removed ? `Removed ${removed} questions from ${previewTopic}.` : `${previewTopic} removed from the chapter plan.`);
  };

  const previewTopicQuestionCount = useMemo(
    () => previewTopic ? paperQuestions.filter(question => question.topic === previewTopic).length : 0,
    [paperQuestions, previewTopic],
  );

  useEffect(() => {
    setCheckedPreviewIds([]);
    if (!previewTopic) { setTopicPreviewQuestions([]); return; }
    const loadPreview = async () => {
      setPreviewLoading(true);
      try {
        const token = localStorage.getItem('arke_token');
        const queryParams: Record<string, string> = { page: '1', limit: '12', class_std: selectedClass, topic: previewTopic, lang: selectedLang };
        if (questionType !== 'all') queryParams.question_type = questionType;
        const query = new URLSearchParams(queryParams);
        if (!isMultiSubjectExam) query.set('subject', selectedSubject);
        const response = await fetch(`/api/questions?${query}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setTopicPreviewQuestions(data.questions || []);
      } catch (error) {
        setTopicPreviewQuestions([]);
        showToast(error instanceof Error ? error.message : 'Could not load topic questions.');
      } finally { setPreviewLoading(false); }
    };
    void loadPreview();
  // Topic selection is explicit; this fetch is intentionally scoped to its latest selection.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewTopic, selectedClass, selectedLang, selectedSubject, isMultiSubjectExam, questionType]);

  // Generate Paper API Call
  const handleGeneratePaper = async () => {
    const remaining = totalQuestions - paperQuestions.length;
    if (remaining <= 0) {
      setStudioTab('editor');
      setBuilderMode('edit');
      showToast(`✓ Paper ready with ${paperQuestions.length} selected questions!`);
      return;
    }
    setGenerating(true);
    try {
      const token = localStorage.getItem('arke_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/paper/generate', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          class_std: selectedClass,
          subject: selectedSubject,
          subjects: selectedSubjects,
          topics: selectedTopics,
          totalQuestions: remaining,
          difficultyDistribution: {
            easy: easyPct,
            medium: medPct,
            hard: hardPct,
          },
          lang: selectedLang,
          hasImageOnly,
          pyqOnly,
          questionType,
          marksPerQuestion,
          negativeMarks,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate question paper from database');
      }

      if (Array.isArray(data.questions) && data.questions.length > 0) {
        const existingIds = new Set(paperQuestions.map(question => String(question._id || question.id)));
        const additions = data.questions.filter((question: QuestionItem) => !existingIds.has(String(question._id || question.id)));
        if (!additions.length) throw new Error('Those generated questions are already in this paper. Change the filters or add a different topic.');
        setPaperQuestions(previous => [...previous, ...additions]);
        setStudioTab('editor');
        setBuilderMode('edit');
        showToast(`🎉 Added ${additions.length} generated questions. Your paper now has ${paperQuestions.length + additions.length}/${totalQuestions} questions.`);
      } else {
        throw new Error('No questions found matching criteria.');
      }
    } catch (err: any) {
      showToast(`Generation Failed: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // Move Question Up / Down
  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= paperQuestions.length) return;

    const updated = [...paperQuestions];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setPaperQuestions(updated);
  };

  // Delete Question from Paper
  const handleDeleteQuestion = (index: number) => {
    const updated = paperQuestions.filter((_, i) => i !== index);
    setPaperQuestions(updated);
    showToast(`Question removed from paper. (${updated.length} remaining)`);
  };

  // 1-Click Swap Question with similar topic & difficulty
  const handleSwapQuestion = async (index: number) => {
    const currentQ = paperQuestions[index];
    if (!currentQ) return;

    setSwappingId(currentQ._id || currentQ.id || index);
    try {
      const token = localStorage.getItem('arke_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const excludeIds = paperQuestions.map((q) => q._id || q.id).filter(Boolean);

      const res = await fetch('/api/paper/swap', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          class_std: currentQ.class_std || selectedClass,
          subject: currentQ.subject || selectedSubject,
          topic: currentQ.topic,
          difficulty: currentQ.difficulty,
          lang: currentQ.lang,
          excludeIds,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.question) {
        throw new Error(data.error || 'No replacement question available.');
      }

      const updated = [...paperQuestions];
      updated[index] = {
        ...data.question,
        marks: currentQ.marks || marksPerQuestion,
        negative_marks: currentQ.negative_marks || negativeMarks,
      };
      setPaperQuestions(updated);
      showToast(`🔄 Question Q.${index + 1} swapped with fresh question!`);
    } catch (err: any) {
      showToast(`Swap failed: ${err.message}`);
    } finally {
      setSwappingId(null);
    }
  };

  // Toggle Language of individual question (EN <-> HI) with real MongoDB data fetching
  const handleToggleQuestionLang = async (index: number) => {
    const currentQ = paperQuestions[index];
    if (!currentQ) return;
    const currentLang = currentQ.lang ? String(currentQ.lang).toLowerCase() : 'en';
    const targetLang = currentLang === 'hi' ? 'en' : 'hi';

    try {
      showToast(`Fetching ${targetLang === 'hi' ? 'Hindi' : 'English'} version for Q.${index + 1}...`);
      const token = typeof window !== 'undefined' ? localStorage.getItem('arke_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/questions/switch-lang', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          questionId: currentQ.id,
          targetLang,
          subject: currentQ.subject || selectedSubject,
          topic: currentQ.topic,
          difficulty: currentQ.difficulty,
          marks: currentQ.marks,
          negative_marks: currentQ.negative_marks,
        }),
      });

      const data = await res.json();
      if (data.success && data.question) {
        setPaperQuestions((prev) => {
          const next = [...prev];
          next[index] = { ...next[index], ...data.question, lang: targetLang };
          return next;
        });
        showToast(`✓ Question Q.${index + 1} successfully switched to ${targetLang === 'hi' ? 'Hindi' : 'English'}!`);
      } else {
        showToast(`Could not find ${targetLang === 'hi' ? 'Hindi' : 'English'} version: ${data.error || 'Not found'}`);
      }
    } catch (err: any) {
      showToast(`Error switching language: ${err.message}`);
    }
  };

  // Switch all questions in the paper to English or Hindi
  const handleSwitchPaperLanguage = async (targetLang: 'en' | 'hi') => {
    if (paperQuestions.length === 0) return;
    setSwitchingLang(true);
    showToast(`Switching entire paper to ${targetLang === 'hi' ? 'Hindi (हिंदी)' : 'English'}...`);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('arke_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/paper/switch-lang', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          questions: paperQuestions,
          targetLang,
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.questions)) {
        const uniqueQuestions = dedupeQuestions(data.questions);
        setPaperQuestions(uniqueQuestions);
        showToast(`✓ Paper successfully converted to ${targetLang === 'hi' ? 'Hindi' : 'English'} (${uniqueQuestions.length} Qs)!`);
      } else {
        showToast(`Error switching paper language: ${data.error || 'Failed'}`);
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setSwitchingLang(false);
    }
  };

  // Toggle Solution Dropdown per question
  const toggleSolution = (id: string | number) => {
    setOpenSolutions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Save Paper
  const handleSavePaper = async () => {
    if (paperQuestions.length === 0) {
      showToast('Cannot save an empty paper.');
      return;
    }

    setSaving(true);
    const paperId = activePaperId || `paper_${Date.now()}`;
    const createdAt = activePaperCreatedAt || new Date().toISOString();
    const paperPayload = {
      id: paperId,
      title: examTitle,
      instituteName,
      class_std: selectedClass,
      subject: selectedSubject,
      timeAllowed,
      totalMarks: paperQuestions.reduce((s, q) => s + (Number(q.marks) || 4), 0),
      totalQuestions: paperQuestions.length,
      createdAt,
      updatedAt: new Date().toISOString(),
      questions: paperQuestions,
      instructions,
      optionFormat,
      columnsMode,
      optionsLayout,
    };

    // Save to MongoDB. Paper data never falls back to browser storage.
    try {
      const token = localStorage.getItem('arke_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/paper/save', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(paperPayload),
      });

      if (res.ok) {
        setActivePaperId(paperId);
        setActivePaperCreatedAt(createdAt);
        showToast('Paper saved to the shared database.');
      } else {
        const data = await res.json().catch(() => null);
        showToast(data?.error || 'Paper could not be saved to the database.');
      }
    } catch (err) {
      showToast('Paper could not be saved to the database. Check the connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  // Direct Print Trigger
  const handlePrint = (mode: 'paper' | 'solutions') => {
    setStudioTab(mode === 'paper' ? 'preview' : 'solutions');
    setTimeout(() => {
      window.print();
    }, 400);
  };

  // Clear Paper and Reset
  const handleResetPaper = () => {
    if (!resetArmed) {
      setResetArmed(true);
      showToast('Click “New Paper” once more to clear this draft.');
      window.setTimeout(() => setResetArmed(false), 5000);
      return;
    }
    setPaperQuestions([]);
    setActivePaperId(null);
    setActivePaperCreatedAt(null);
    setQuestionUsage({});
    setBuilderMode('configure');
    setBuilderStep(1);
    setResetArmed(false);
    showToast('Paper cleared. Ready to generate a new paper.');
  };

  // Helpers for badge rendering
  const getDifficultyBadge = (diff: any) => {
    const val = String(diff);
    if (val === '0') return <span className="badge badge-diff-basic">Basic (Tier 0)</span>;
    if (val === '1') return <span className="badge badge-diff-easy">Easy (Tier 1)</span>;
    if (val === '2') return <span className="badge badge-diff-med">Medium (Tier 2)</span>;
    if (val === '3') return <span className="badge badge-diff-hard">Hard (Tier 3)</span>;
    if (val === '4') return <span className="badge badge-diff-expert">Expert (Tier 4)</span>;
    return <span className="badge badge-diff-med">Standard</span>;
  };

  const formatOptionKey = (key: string): string => {
    const lower = (key || '').toLowerCase();
    if (optionFormat === '1234') {
      if (lower === 'a') return '1';
      if (lower === 'b') return '2';
      if (lower === 'c') return '3';
      if (lower === 'd') return '4';
      return key;
    }
    return key.toUpperCase();
  };

  const totalMarks = paperQuestions.reduce((s, q) => s + (Number(q.marks) || 4), 0);
  const paperSubjectLabel = selectedSubjects.join(' + ');

  const currentMetadata: PaperMetadata = {
    title: examTitle,
    instituteName,
    class_std: selectedClass,
    subject: paperSubjectLabel,
    timeAllowed,
    totalMarks,
    instructions,
    watermarkText: instituteName || 'ARKE SCHOLARS',
    showWatermark: true,
  };

  return (
    <div className="paper-generator-wrapper">
      {/* Top Paper Studio Navigation & Quick Actions Bar */}
      {builderMode === 'edit' && <div className="paper-studio-nav">
        <div className="studio-nav-left">
          <div className="studio-title-badge">
            <span className="studio-title-text">⚡ Question Paper Studio</span>
          </div>

          {builderMode === 'edit' && paperQuestions.length > 0 && (
            <div className="studio-tabs-row hide-print">
              <button
                type="button"
                className={`studio-tab-btn ${studioTab === 'editor' ? 'active' : ''}`}
                onClick={() => setStudioTab('editor')}
              >
                <span>1. Edit & Organize ({paperQuestions.length})</span>
              </button>
              <button
                type="button"
                className={`studio-tab-btn ${studioTab === 'preview' ? 'active' : ''}`}
                onClick={() => setStudioTab('preview')}
              >
                <Eye size={13} />
                <span>2. Student Paper (Printable)</span>
              </button>
              <button
                type="button"
                className={`studio-tab-btn ${studioTab === 'solutions' ? 'active' : ''}`}
                onClick={() => setStudioTab('solutions')}
              >
                <BookOpen size={13} />
                <span>3. Teacher Solutions Booklet</span>
              </button>
            </div>
          )}
        </div>

        {/* Global Action Buttons */}
        <div className="studio-nav-actions hide-print">
          {builderMode === 'edit' && paperQuestions.length > 0 ? (
            <>
              <button
                type="button"
                onClick={handleSavePaper}
                disabled={saving}
                className="btn-studio-action btn-save"
                title="Save paper to library"
              >
                <Save size={13} />
                <span>{saving ? 'Saving...' : 'Save Paper'}</span>
              </button>

              <button
                type="button"
                onClick={() => handlePrint('paper')}
                className="btn-studio-action btn-print-paper"
                title="Print student question paper"
              >
                <Printer size={13} />
                <span>Print Student Paper</span>
              </button>

              <button
                type="button"
                onClick={() => handlePrint('solutions')}
                className="btn-studio-action btn-print-sol"
                title="Print teacher solutions booklet"
              >
                <FileText size={13} />
                <span>Print Solutions</span>
              </button>

              <button type="button" onClick={() => setExamCreatorOpen(true)} className="btn-studio-action btn-create-exam" title="Create a secure student exam from this paper">
                <ShieldCheck size={13} />
                <span>Create Exam</span>
              </button>

              <button
                type="button"
                onClick={handleResetPaper}
                className="btn-studio-action btn-reset-paper"
                title="Start a new paper"
              >
                <RotateCcw size={12} />
                <span>{resetArmed ? 'Confirm clear' : 'New Paper'}</span>
              </button>
            </>
          ) : null}
        </div>
      </div>}

      {/* STATE 1: Blueprint Generator Form */}
      {builderMode === 'configure' ? (
        <div className="generator-wizard-container" data-step={builderStep}>
          <div className="builder-steps" aria-label="Paper builder steps">
            <button type="button" className={builderStep === 1 ? 'active' : ''} onClick={() => setBuilderStep(1)}><em>01</em> Blueprint</button><i></i>
            <button type="button" className={builderStep === 2 ? 'active' : ''} onClick={() => setBuilderStep(2)}><em>02</em> Pick questions</button><i></i>
            <button type="button" className={builderStep === 3 ? 'active' : ''} onClick={openBalanceStep}><em>03</em> Balance & build</button>
            <b>{paperQuestions.length} / {totalQuestions} selected</b>{paperQuestions.length > 0 && <button type="button" className="open-paper-button" onClick={() => { setBuilderMode('edit'); setStudioTab('editor'); }}>Open paper →</button>}
          </div>
          {/* Preset Buttons Bar */}
          <div className="presets-bar">
            <span className="presets-bar-label">1-Click Presets:</span>
            <div className="presets-pills-row">
              <button type="button" onClick={() => applyPreset('balanced')} className="preset-chip">
                ⚡ Balanced (25 Qs • 60m)
              </button>
              <button type="button" onClick={() => applyPreset('jee_main')} className="preset-chip">
                🎯 JEE Main (25 Qs • +4/-1)
              </button>
              <button type="button" onClick={() => applyPreset('neet')} className="preset-chip">
                🩺 NEET Mock (45 Qs)
              </button>
              <button type="button" onClick={() => applyPreset('cbse')} className="preset-chip">
                📖 CBSE Board (35 Qs)
              </button>
              <button type="button" onClick={() => applyPreset('foundation')} className="preset-chip">
                🌱 Foundation (20 Qs)
              </button>
              <button type="button" onClick={() => applyPreset('advanced')} className="preset-chip">
                🔥 Advanced (30 Qs)
              </button>
            </div>
          </div>

          {/* Configuration Two-Column Grid */}
          <div className="wizard-form-grid">
            {/* Left Card: Target Class & Chapters */}
            <div className="wizard-card builder-selection-card">
              <h3 className="card-heading">{builderStep === 1 ? '1. Assessment blueprint' : '2. Chapters & question picker'}</h3>

              <div className="form-fields-grid blueprint-step step-one">
                <div className="form-field full-col">
                  <label className="field-label">Target Class / Stream</label>
                  <div className="pill-grid">
                    {taxonomyLoading && availableClasses.length === 0 ? <span className="taxonomy-loading">Loading available classes…</span> : availableClasses.map((cls) => (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => {
                          setSelectedClass(cls);
                          // Do not leave stale subjects from the previous
                          // class visible while the content-backed list loads.
                          setSelectedSubjects([]);
                          setAvailableSubjects([]);
                          setAvailableTopics([]);
                          setPickerSubject('');
                          setPreviewTopic('');
                          setTopicPreviewQuestions([]);
                        }}
                        className={`pill-option ${selectedClass === cls ? 'active' : ''}`}
                      >
                        {cls}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-field full-col">
                  <label className="field-label">{isMultiSubjectExam ? 'Subjects (select one or more)' : 'Subject'}</label>
                  <div className="pill-grid">
                    {taxonomyLoading ? <span className="taxonomy-loading">Checking subjects with questions…</span> : eligibleSubjects.map((sub) => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => handleSelectSubject(sub)}
                        className={`pill-option ${selectedSubjects.includes(sub) ? 'active' : ''}`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                  {!taxonomyLoading && taxonomyError && <p className="taxonomy-inline-state" role="status">{taxonomyError}</p>}
                  {!taxonomyLoading && !taxonomyError && eligibleSubjects.length === 0 && <p className="taxonomy-inline-state" role="status">No subjects with questions are available for this class and language.</p>}
                </div>

                {/* Question Type / Pattern Selector */}
                <div className="form-field full-col">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="field-label" style={{ marginBottom: 0 }}>Question Pattern / Format (प्रश्न प्रकार)</label>
                    <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Select format or mix all</span>
                  </div>
                  <div className="pill-grid question-type-grid">
                    {QUESTION_TYPE_OPTIONS.filter((item) => availableQuestionTypes.includes(item.id)).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setQuestionType(item.id)}
                        className={`pill-option ${questionType === item.id ? 'active' : ''}`}
                        title={item.title}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-field full-col">
                  <label className="field-label">Exam Title</label>
                  <input
                    type="text"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    placeholder="e.g. JEE Main Full Assessment 2026"
                    className="wizard-input"
                  />
                </div>

                <div className="form-field full-col">
                  <label className="field-label">Institute / Academy Name</label>
                  <input
                    type="text"
                    value={instituteName}
                    onChange={(e) => setInstituteName(e.target.value)}
                    placeholder="e.g. ARKE SCHOLARS ACADEMY"
                    className="wizard-input"
                  />
                </div>

                <div className="form-field full-col">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="field-label" style={{ marginBottom: 0 }}>Target Paper Slots (कुल प्रश्न संख्या)</label>
                    <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>Sets slots for chapter fill & paper size</span>
                  </div>
                  <div className="number-stepper-row">
                    {[10, 15, 20, 25, 30, 35, 40, 45, 50, 75].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setTotalQuestions(cnt)}
                        className={`stepper-pill ${totalQuestions === cnt ? 'active' : ''}`}
                      >
                        {cnt} Qs
                      </button>
                    ))}
                    <div className="custom-count-wrap">
                      <span className="custom-count-label">Custom:</span>
                      <input
                        type="number"
                        min={1}
                        max={180}
                        value={totalQuestions}
                        onChange={(e) => setTotalQuestions(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="custom-stepper-input"
                        title="Set target question slots"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Chapters Selector with Search */}
              <div className="topics-selection-box blueprint-step step-two">
                <div className="topics-header-row">
                  <label className="field-label">
                    Chapters in this paper plan ({selectedTopics.length})
                  </label>
                  <div className="topics-quick-actions">
                    <button type="button" onClick={handleSelectAllTopics} className="btn-text-action">Select All</button>
                    <span className="dot-sep">•</span>
                    <button type="button" onClick={handleClearAllTopics} className="btn-text-action">Clear All</button>
                  </div>
                </div>

                <div className="chapter-question-split">
                  <aside className="chapter-list-panel" aria-label="Chapter list">
                    <div className="picker-subject-tabs" aria-label="Subjects with available questions">
                      {(isMultiSubjectExam ? selectedSubjects : [selectedSubject]).map((subject) => <button key={subject} type="button" className={pickerSubject === subject ? 'active' : ''} onClick={() => { setPickerSubject(subject); setPreviewTopic(''); setTopicPreviewQuestions([]); }}>{subject}</button>)}
                    </div>
                    <p className="chapter-list-hint">Click a chapter to inspect it. Add or remove its questions from the panel on the right.</p>
                {/* Search Chapters */}
                <div className="chapter-search-wrap">
                  <Search size={14} className="chapter-search-icon" />
                  <input
                    type="text"
                    placeholder="Filter chapters (e.g. Optics, Mechanics, Thermodynamics)..."
                    value={chapterSearch}
                    onChange={(e) => setChapterSearch(e.target.value)}
                    className="chapter-search-input"
                  />
                  {chapterSearch && (
                    <button type="button" onClick={() => setChapterSearch('')} className="chapter-search-clear">×</button>
                  )}
                </div>

                <div className="topics-chips-scroll">
                  {availableTopics.length === 0 ? (
                    <div className="no-topics-notice">Loading chapters from syllabus database...</div>
                  ) : filteredTopics.length === 0 ? (
                    <div className="no-topics-notice">No chapters matching &ldquo;{chapterSearch}&rdquo;</div>
                  ) : (
                    visibleTopics.map((top) => {
                      const isChecked = selectedTopics.includes(top);
                      return (
                        <button
                          key={top}
                          type="button"
                          onClick={() => handleToggleTopic(top)}
                          className={`topic-chip ${isChecked ? 'active' : ''}`}
                        >
                          <span className="chip-indicator">{isChecked ? '✓' : '+'}</span>
                          <span className="chip-text">{top}</span>
                        </button>
                      );
                    })
                  )}
                  {!chapterSearch && filteredTopics.length > 18 && <button type="button" className="topic-chip topic-more-toggle" onClick={() => setShowAllTopics((value) => !value)}>{showAllTopics ? 'Show fewer chapters' : `Show ${filteredTopics.length - 18} more chapters`}</button>}
                </div>
                  </aside>
                  <section className="question-picker-pane" aria-label="Questions in selected chapter">
                <div className="topic-preview-panel">
                  <div className="topic-preview-header">
                    <div>
                      <span>{replacementIndex !== null ? 'REPLACE QUESTION' : 'QUESTION PICKER'}</span>
                      <div>
                        <h4>{replacementIndex !== null ? `Choose a replacement for Question ${replacementIndex + 1}${previewTopic ? ` · ${previewTopic}` : ''}` : previewTopic ? `${previewTopic} questions` : 'Choose a chapter to inspect questions'}</h4>
                        {previewTopic && (
                          <div className="picker-type-filter-row">
                            {QUESTION_TYPE_OPTIONS.filter((item) => availableQuestionTypes.includes(item.id)).map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setQuestionType(t.id)}
                                className={`picker-type-btn ${questionType === t.id ? 'active' : ''}`}
                              >
                                {t.shortLabel}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="topic-preview-actions">
                      <div className="slots-inline-bar" title="Change target slots for this paper">
                        <span className="slots-inline-label">Target Slots:</span>
                        <div className="slots-quick-controls">
                          <button
                            type="button"
                            className="btn-slot-adjust"
                            onClick={() => setTotalQuestions((prev) => Math.max(paperQuestions.length || 1, prev - 5))}
                            title="Decrease target slots by 5"
                          >
                            -5
                          </button>
                          <button
                            type="button"
                            className="btn-slot-adjust"
                            onClick={() => setTotalQuestions((prev) => Math.max(paperQuestions.length || 1, prev - 1))}
                            title="Decrease target slots by 1"
                          >
                            -1
                          </button>
                          <input
                            type="number"
                            min={paperQuestions.length || 1}
                            max={200}
                            value={totalQuestions}
                            onChange={(e) => setTotalQuestions(Math.max(paperQuestions.length || 1, parseInt(e.target.value, 10) || 1))}
                            className="input-slot-number"
                            title="Change target paper slots"
                          />
                          <button
                            type="button"
                            className="btn-slot-adjust"
                            onClick={() => setTotalQuestions((prev) => prev + 1)}
                            title="Increase target slots by 1"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            className="btn-slot-adjust"
                            onClick={() => setTotalQuestions((prev) => prev + 5)}
                            title="Increase target slots by 5"
                          >
                            +5
                          </button>
                        </div>
                      </div>
                      {replacementIndex === null && checkedPreviewIds.length > 0 && <button type="button" className="add-topic-preview" onClick={handleAddCheckedPreviewQuestions}>Add checked ({checkedPreviewIds.length})</button>}
                      {replacementIndex === null && previewTopic && <button type="button" className="fill-topic-preview" onClick={() => void handleFillFromPreviewTopic()} disabled={generating || paperQuestions.length >= totalQuestions}>{generating ? 'Adding…' : `Add chapter · ${Math.max(0, totalQuestions - paperQuestions.length)} slots`}</button>}
                      {replacementIndex === null && previewTopic && <button type="button" className="remove-topic-preview" onClick={handleRemovePreviewTopicQuestions}>Remove chapter{previewTopicQuestionCount ? ` (${previewTopicQuestionCount})` : ''}</button>}
                      {replacementIndex !== null && <button type="button" className="fill-topic-preview" onClick={() => { setReplacementIndex(null); setBuilderMode('edit'); setStudioTab('editor'); }}>Cancel replace</button>}
                      {previewTopic && replacementIndex === null && <button type="button" onClick={() => setPreviewTopic('')}>Close</button>}
                    </div>
                  </div>
                  {previewTopic && replacementIndex === null && <p className="chapter-picker-help">Add chapter fills only the remaining paper slots. Remove chapter removes every question currently added from this chapter.</p>}
                  {!previewTopic ? <div className="topic-picker-empty"><BookOpen size={22}/><b>{replacementIndex !== null ? 'Choose a chapter for the replacement' : 'Select a chapter to start'}</b><span>Click the + beside any chapter above. Its questions will appear here for review.</span></div> : previewLoading ? <div className="topic-picker-empty"><RefreshCw size={20} className="spin-icon"/><b>Loading chapter questions</b><span>Fetching the matching {selectedLang === 'hi' ? 'Hindi' : 'English'} records.</span></div> : topicPreviewQuestions.length === 0 ? <div className="topic-picker-empty"><Filter size={22}/><b>No questions found</b><span>Try another chapter or change the paper language.</span></div> : <div className="topic-preview-list">{topicPreviewQuestions.map((question, index) => { const questionKey = String(question._id || question.id); const isAdded = paperQuestions.some(item => String(item._id || item.id) === questionKey); const isChecked = checkedPreviewIds.includes(questionKey); return <article className="topic-preview-card" key={questionKey}><header><div><b>Question {index + 1}</b><span>#{question.id}</span></div><span className="topic-tier">{question.difficulty !== undefined && question.difficulty !== null ? `Tier ${question.difficulty}` : 'Tagged'}</span><label className="picker-check"><input type="checkbox" checked={isChecked} disabled={isAdded || replacementIndex !== null} onChange={() => setCheckedPreviewIds(previous => previous.includes(questionKey) ? previous.filter(id => id !== questionKey) : [...previous, questionKey])}/><span>Select</span></label></header><p className="topic-question-stem">{compactQuestionText(question.question)}</p><div className="topic-preview-meta"><span>{question.options?.length || 0} options</span>{question.question_image && <span>Diagram included</span>}<span>{question.subject || selectedSubject}</span></div><button type="button" onClick={() => handleAddPreviewQuestion(question)} disabled={isAdded}>{isAdded ? <><Check size={14}/> Already in paper</> : replacementIndex !== null ? <><RefreshCw size={14}/> Use as replacement</> : <><Plus size={14}/> Add this question</>}</button></article>; })}</div>}
                </div>
                  </section>
                </div>
              </div>
            </div>

            {/* Right Card: Question Blueprint & Difficulty */}
            <div className="wizard-card builder-blueprint-card blueprint-step step-three">
              <h3 className="card-heading">3. Question count & difficulty balance</h3>

              <div className="form-fields-grid">
                <div className="form-field full-col">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="field-label" style={{ marginBottom: 0 }}>Total Questions Count</label>
                    {paperQuestions.length > 0 && (
                      <span style={{ fontSize: '0.74rem', background: '#EFF6FF', color: '#1D4ED8', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                        ✓ Manual selection: {paperQuestions.length} questions
                      </span>
                    )}
                  </div>
                  {paperQuestions.length > 0 ? (
                    <div className="manual-selection-lock" role="status">
                      <b>{paperQuestions.length} questions selected</b>
                      <span>This paper will contain only the questions you picked. Go back to “Pick questions” to add or remove any question.</span>
                    </div>
                  ) : (
                    <div className="number-stepper-row">
                      {[10, 15, 20, 25, 30, 45, 50, 75].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setTotalQuestions(cnt)}
                          className={`stepper-pill ${totalQuestions === cnt ? 'active' : ''}`}
                        >
                          {cnt} Qs
                        </button>
                      ))}
                      <div className="custom-count-wrap">
                        <span className="custom-count-label">Custom:</span>
                        <input
                          type="number"
                          min={1}
                          max={180}
                          value={totalQuestions}
                          onChange={(e) => setTotalQuestions(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="custom-stepper-input"
                          title="Custom questions count"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-field">
                  <label className="field-label">Time Duration</label>
                  <input
                    type="text"
                    value={timeAllowed}
                    onChange={(e) => setTimeAllowed(e.target.value)}
                    placeholder="e.g. 60 Mins or 3 Hours"
                    className="wizard-input"
                  />
                </div>

                <div className="form-field full-col">
                  <label className="field-label">Paper Language / माध्यम</label>
                  <div className="pill-grid">
                    <button
                      type="button"
                      onClick={() => setSelectedLang('en')}
                      className={`pill-option ${selectedLang === 'en' ? 'active' : ''}`}
                    >
                      English (EN)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedLang('hi')}
                      className={`pill-option ${selectedLang === 'hi' ? 'active' : ''}`}
                    >
                      हिंदी (Hindi)
                    </button>
                  </div>
                </div>

                <div className="form-field">
                  <label className="field-label">Marks / Correct</label>
                  <input
                    type="number"
                    min={1}
                    value={marksPerQuestion}
                    onChange={(e) => setMarksPerQuestion(parseInt(e.target.value, 10) || 4)}
                    className="wizard-input"
                  />
                </div>

                <div className="form-field">
                  <label className="field-label">Negative Marks</label>
                  <input
                    type="number"
                    min={0}
                    value={negativeMarks}
                    onChange={(e) => setNegativeMarks(parseInt(e.target.value, 10) || 0)}
                    className="wizard-input"
                  />
                </div>

                {/* Question Type Pattern in Step 3 */}
                <div className="form-field full-col">
                  <label className="field-label">Question Pattern (प्रश्न प्रकार)</label>
                  <div className="pill-grid question-type-grid">
                    {QUESTION_TYPE_OPTIONS.filter((item) => availableQuestionTypes.includes(item.id)).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setQuestionType(item.id)}
                        className={`pill-option ${questionType === item.id ? 'active' : ''}`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-field full-col">
                  <label className="field-label">Question Filters</label>
                  <div className="checkboxes-row">
                    <label className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={pyqOnly}
                        onChange={(e) => setPyqOnly(e.target.checked)}
                      />
                      <span>Previous Year Questions (PYQ) Only</span>
                    </label>
                    <label className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={hasImageOnly}
                        onChange={(e) => setHasImageOnly(e.target.checked)}
                      />
                      <span>Diagrams Only</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Difficulty Ratio Breakdown */}
              <div className="difficulty-ratio-box">
                <div className="ratio-header-row">
                  <span className="ratio-title">Difficulty Distribution</span>
                  <span className="ratio-subtitle">
                    Easy: {easyPct}% • Med: {medPct}% • Hard: {hardPct}%
                  </span>
                </div>

                <div className="ratio-visual-bar">
                  <div className="bar-seg seg-easy" style={{ width: `${easyPct}%` }}>Easy {easyPct}%</div>
                  <div className="bar-seg seg-med" style={{ width: `${medPct}%` }}>Medium {medPct}%</div>
                  <div className="bar-seg seg-hard" style={{ width: `${hardPct}%` }}>Hard {hardPct}%</div>
                </div>

                <div className="ratio-sliders-row">
                  <div className="slider-item">
                    <span className="slider-label">Easy ({easyPct}%)</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={easyPct}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setEasyPct(val);
                        const rem = 100 - val;
                        setMedPct(Math.round(rem * 0.7));
                        setHardPct(rem - Math.round(rem * 0.7));
                      }}
                      className="range-input slider-easy"
                    />
                  </div>

                  <div className="slider-item">
                    <span className="slider-label">Medium ({medPct}%)</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={medPct}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        const rem = 100 - val;
                        setMedPct(val);
                        setEasyPct(Math.round(rem * 0.6));
                        setHardPct(rem - Math.round(rem * 0.6));
                      }}
                      className="range-input slider-med"
                    />
                  </div>

                  <div className="slider-item">
                    <span className="slider-label">Hard ({hardPct}%)</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={hardPct}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        const rem = 100 - val;
                        setHardPct(val);
                        setEasyPct(Math.round(rem * 0.4));
                        setMedPct(rem - Math.round(rem * 0.4));
                      }}
                      className="range-input slider-hard"
                    />
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <div className="wizard-action-footer">
                <button
                  type="button"
                  onClick={handleGeneratePaper}
                  disabled={generating}
                  className="btn-huge-generate"
                >
                  <Sparkles size={16} />
                  <span>
                    {generating
                      ? 'Generating from 5.27 Lakh Databank...'
                      : paperQuestions.length > 0
                      ? `Open paper with ${paperQuestions.length} selected questions`
                      : `⚡ Generate ${totalQuestions} Questions Paper`}
                  </span>
                </button>
              </div>
            </div>
          </div>
          <div className="wizard-step-footer">
            <div><span>STEP {builderStep} OF 3</span><b>{builderStep === 1 ? 'Set the assessment basics' : builderStep === 2 ? 'Select chapters and inspect real questions' : 'Set the paper balance before generating'}</b></div>
            <div>
              {builderStep > 1 && (
                <button type="button" className="wizard-back-button" onClick={() => setBuilderStep((builderStep - 1) as 1 | 2)}>
                  Back
                </button>
              )}
              {builderStep < 3 ? (
                <button
                  type="button"
                  className="wizard-next-button"
                  onClick={() => {
                    if (builderStep === 2) {
                      openBalanceStep();
                      return;
                    }
                    setBuilderStep(2);
                  }}
                >
                  {builderStep === 1 ? 'Choose chapters' : 'Set paper balance'} <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  className="wizard-next-button wizard-generate-button"
                  onClick={() => void handleGeneratePaper()}
                  disabled={generating}
                >
                  <Sparkles size={16} />
                  {generating
                    ? 'Building paper…'
                    : paperQuestions.length >= totalQuestions
                    ? `Build Paper with ${paperQuestions.length} Selected Questions →`
                    : paperQuestions.length > 0
                    ? `Generate ${totalQuestions - paperQuestions.length} More (${totalQuestions} Total) →`
                    : `Generate ${totalQuestions} Question Paper →`}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* STATE 2: Interactive Paper Studio (Organize / Student Paper / Solutions) */
        <div className="paper-studio-container">
          {/* Paper Customization Toolbar (Options Style, Layout, Grid) */}
          <div className="paper-customization-toolbar hide-print">
            <div className="toolbar-setting-group">
              <span className="setting-label">Language:</span>
              <div className="setting-pill-buttons">
                <button
                  type="button"
                  disabled={switchingLang}
                  onClick={() => handleSwitchPaperLanguage('en')}
                  className={`btn-format-pill ${paperQuestions.some(q => (q.lang || 'en').toLowerCase() === 'en') ? 'active' : ''}`}
                >
                  English (EN)
                </button>
                <button
                  type="button"
                  disabled={switchingLang}
                  onClick={() => handleSwitchPaperLanguage('hi')}
                  className={`btn-format-pill ${paperQuestions.every(q => (q.lang || '').toLowerCase() === 'hi') ? 'active' : ''}`}
                >
                  {switchingLang ? 'Switching...' : 'हिंदी (HI)'}
                </button>
              </div>
            </div>

            <div className="toolbar-setting-group">
              <span className="setting-label">Option Labels:</span>
              <div className="setting-pill-buttons">
                <button
                  type="button"
                  onClick={() => setOptionFormat('abcd')}
                  className={`btn-format-pill ${optionFormat === 'abcd' ? 'active' : ''}`}
                >
                  (A), (B), (C), (D)
                </button>
                <button
                  type="button"
                  onClick={() => setOptionFormat('1234')}
                  className={`btn-format-pill ${optionFormat === '1234' ? 'active' : ''}`}
                >
                  (1), (2), (3), (4)
                </button>
              </div>
            </div>

            <div className="toolbar-setting-group">
              <span className="setting-label">Print Layout:</span>
              <div className="setting-pill-buttons">
                <button
                  type="button"
                  onClick={() => setColumnsMode('1-col')}
                  className={`btn-format-pill ${columnsMode === '1-col' ? 'active' : ''}`}
                >
                  Single Column
                </button>
                <button
                  type="button"
                  onClick={() => setColumnsMode('2-col')}
                  className={`btn-format-pill ${columnsMode === '2-col' ? 'active' : ''}`}
                >
                  Dual Column (2 Pages)
                </button>
              </div>
            </div>

            <div className="toolbar-setting-group">
              <span className="setting-label">Options Grid:</span>
              <div className="setting-pill-buttons">
                <button
                  type="button"
                  onClick={() => setOptionsLayout('2-col')}
                  className={`btn-format-pill ${optionsLayout === '2-col' ? 'active' : ''}`}
                >
                  2x2 Grid
                </button>
                <button
                  type="button"
                  onClick={() => setOptionsLayout('4-col')}
                  className={`btn-format-pill ${optionsLayout === '4-col' ? 'active' : ''}`}
                >
                  4 Columns (Row)
                </button>
                <button
                  type="button"
                  onClick={() => setOptionsLayout('1-col')}
                  className={`btn-format-pill ${optionsLayout === '1-col' ? 'active' : ''}`}
                >
                  Vertical
                </button>
              </div>
            </div>
          </div>

          {/* Studio Summary Bar */}
          <div className="studio-summary-bar hide-print">
            <div className="summary-left">
              <span className="summary-title">{examTitle}</span>
              <span className="summary-meta">
                {selectedClass} • {selectedSubject} • {timeAllowed}
              </span>
            </div>

            <div className="summary-stats-pills">
              <div className="stat-pill">
                <span className="stat-label">Questions:</span>
                <span className="stat-value">{paperQuestions.length}</span>
              </div>
              <div className="stat-pill">
                <span className="stat-label">Max Marks:</span>
                <span className="stat-value">{totalMarks} (+{marksPerQuestion}/-{negativeMarks})</span>
              </div>
            </div>
          </div>

          {/* TAB 1: Editor & Reordering Workspace */}
          {studioTab === 'editor' && (
            <div className="studio-editor-view hide-print">
              <div className="editor-questions-list">
                {paperQuestions.map((q, idx) => {
                  const qNum = idx + 1;
                  const isSwapping = swappingId === (q._id || q.id || idx);
                  const isSolutionOpen = Boolean(openSolutions[q._id || q.id || idx]);
                  const priorUses = questionUsage[String(q._id || q.id)] || questionUsage[String(q.id)] || [];

                  return (
                    <div key={q._id || q.id || idx} className="question-card">
                      {/* Card Header matching exact Question Bank style */}
                      <div className="card-top-row">
                        <div className="card-left-badges">
                          <span className="q-index-pill">Q.{qNum}</span>
                          <span className="badge badge-subject">{q.subject || selectedSubject}</span>
                          <span className="badge badge-class">{q.class_std || selectedClass}</span>
                          {(() => {
                            const hasValidOptions = Array.isArray(q.options) && q.options.some((opt) => (opt.text && opt.text.trim().length > 0) || (opt.image && opt.image.trim().length > 0));
                            const qLower = (q.question || '').toLowerCase();
                            let typeLabel = 'MCQ';
                            let typeClass = 'badge-qtype-mcq';

                            if (qLower.includes('true or false') || qLower.includes('सत्य या असत्य') || qLower.includes('सत्य/असत्य')) {
                              typeLabel = 'True / False';
                              typeClass = 'badge-qtype-tf';
                            } else if (!hasValidOptions && q.correct_answer && String(q.correct_answer).trim().length > 0) {
                              typeLabel = 'Numerical';
                              typeClass = 'badge-qtype-num';
                            } else if (!hasValidOptions) {
                              typeLabel = 'Subjective';
                              typeClass = 'badge-qtype-subj';
                            }

                            return <span className={`badge ${typeClass}`}>{typeLabel}</span>;
                          })()}
                          {getDifficultyBadge(q.difficulty)}
                          {q.year && Number(q.year) > 0 ? (
                            <span className="badge badge-pyq">
                              <Calendar size={11} />
                              <span>PYQ {q.year}</span>
                            </span>
                          ) : null}
                          {priorUses.length > 0 && (
                            <span className="badge badge-reused" title={priorUses.map((usage) => usage.title).join(', ')}>
                              <Copy size={10} />
                              Used in {priorUses.length} saved {priorUses.length === 1 ? 'paper' : 'papers'}
                            </span>
                          )}
                          {/* Language Switcher Badge */}
                          <button
                            type="button"
                            onClick={() => handleToggleQuestionLang(idx)}
                            className="badge badge-lang"
                            title="Click to toggle English / Hindi"
                            style={{ cursor: 'pointer' }}
                          >
                            <Languages size={10} style={{ marginRight: '2px' }} />
                            <span>{q.lang ? String(q.lang).toUpperCase() : 'EN'}</span>
                          </button>
                        </div>

                        {/* Right Action Buttons Toolbar */}
                        <div className="card-right-actions">
                          <span className="badge badge-id">#{q.id}</span>

                          {/* Reorder Up/Down */}
                          <button
                            type="button"
                            onClick={() => handleMoveQuestion(idx, 'up')}
                            disabled={idx === 0}
                            className="btn-card-action"
                            title="Move Question Up"
                            style={{ padding: '4px 6px' }}
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveQuestion(idx, 'down')}
                            disabled={idx === paperQuestions.length - 1}
                            className="btn-card-action"
                            title="Move Question Down"
                            style={{ padding: '4px 6px' }}
                          >
                            <ArrowDown size={12} />
                          </button>

                          {/* Replace / Swap Question */}
                          <button
                            type="button"
                            onClick={() => handleSwapQuestion(idx)}
                            disabled={isSwapping}
                            className="btn-card-action btn-swap-tag"
                            title="Replace with similar question from bank"
                          >
                            <RefreshCw size={12} className={isSwapping ? 'animate-spin' : ''} />
                            <span>{isSwapping ? 'Swapping...' : 'Replace Question'}</span>
                          </button>

                          {/* Choose a chapter-matched replacement */}
                          <button
                            type="button"
                            onClick={() => openChapterReplacementPicker(idx)}
                            className="btn-card-action btn-edit-tag"
                            title="Choose a replacement from this question's chapter"
                          >
                            <Pencil size={12} />
                            <span>Choose from chapter</span>
                          </button>

                          {/* Remove Question */}
                          <button
                            type="button"
                            onClick={() => handleDeleteQuestion(idx)}
                            className="btn-card-action btn-del-tag"
                            title="Remove from paper"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {priorUses.length > 0 && (
                        <div className="question-reuse-note" role="status">
                          <Copy size={13} aria-hidden="true" />
                          <span>
                            <b>Reuse check:</b> this question is already in {priorUses.map((usage) => usage.title).join(', ')}.
                            Use <b>Replace Question</b> or the remove icon above if you do not want it repeated.
                          </span>
                        </div>
                      )}

                      {/* Breadcrumb Hierarchy */}
                      {(q.topic || q.sub_topic) && (
                        <div className="taxonomy-breadcrumb">
                          <BookOpen size={12} className="crumb-icon" />
                          <span className="crumb-topic">{q.topic || 'General Topic'}</span>
                          {q.sub_topic && (
                            <>
                              <span className="crumb-sep">›</span>
                              <span className="crumb-subtopic">{q.sub_topic}</span>
                            </>
                          )}
                          <span className="crumb-sep">•</span>
                          <span className="crumb-marks">Marks: +{q.marks || marksPerQuestion} / -{q.negative_marks || negativeMarks}</span>
                        </div>
                      )}

                      {/* Question Stem Text */}
                      <div className="card-question-text">
                        <MathRenderer content={q.question} />

                        {q.question_image && (
                          <div className="q-diagram-container">
                            <img
                              src={q.question_image}
                              alt={`Question ${qNum} diagram`}
                              className="diagram-image-preview"
                              onClick={() => onImageZoom(q.question_image || '', `Question ${qNum} Diagram`)}
                            />
                          </div>
                        )}
                      </div>

                      {/* Options Grid (or Numerical/Subjective Indicator) */}
                      {(() => {
                        const hasValidOptions = Array.isArray(q.options) && q.options.some((opt) => (opt.text && opt.text.trim().length > 0) || (opt.image && opt.image.trim().length > 0));
                        if (hasValidOptions) {
                          return (
                        <div className={`options-grid ${optionsLayout === '4-col' ? 'grid-4-col' : optionsLayout === '1-col' ? 'grid-1-col' : ''}`}>
                          {q.options?.map((opt) => {
                            const isCorrect = (
                              (q.correct_option && q.correct_option.toLowerCase() === opt.key?.toLowerCase()) ||
                              (q.correct_answer && q.correct_answer.toLowerCase() === opt.key?.toLowerCase())
                            );
                            const displayLetter = formatOptionKey(opt.key);

                            return (
                              <div
                                key={opt.key}
                                className={`option-card ${isCorrect ? 'option-correct' : ''}`}
                              >
                                <span className={`option-letter ${isCorrect ? 'letter-correct' : ''}`}>
                                  {displayLetter}
                                </span>
                                <div className="option-body">
                                  {opt.text && <MathRenderer content={opt.text} inline />}
                                  {opt.image && (
                                    <div className="option-image-wrap">
                                      <img
                                        src={opt.image}
                                        alt={`Option ${displayLetter}`}
                                        className="option-preview-img"
                                        onClick={() => onImageZoom(opt.image || '', `Option (${displayLetter})`)}
                                      />
                                    </div>
                                  )}
                                </div>
                                {isCorrect && (
                                  <span className="option-correct-badge" title="Verified Correct Option">
                                    <CheckCircle2 size={13} />
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                          );
                        } else {
                          return (
                            <div className="non-mcq-response-box">
                              {q.correct_answer ? (
                                <div className="numerical-ans-callout">
                                  <span className="num-callout-tag">🔢 Numerical / Correct Key:</span>
                                  <span className="num-callout-val"><MathRenderer content={String(q.correct_answer)} inline /></span>
                                </div>
                              ) : (
                                <div className="subjective-ans-callout">
                                  <span>✍️ Subjective / Theory Question (Descriptive response)</span>
                                </div>
                              )}
                            </div>
                          );
                        }
                      })()}

                      {/* Verified Editorial Solution Dropdown */}
                      <div className="card-footer-row">
                        <button
                          type="button"
                          onClick={() => toggleSolution(q._id || q.id || idx)}
                          className="btn-toggle-solution"
                        >
                          <Layers size={13} />
                          <span>View Verified Editorial Solution & Proof</span>
                          {isSolutionOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      </div>

                      {/* Expanded Solution Drawer */}
                      {isSolutionOpen && (
                        <div className="solution-drawer">
                          <div className="solution-drawer-header">
                            <span className="sol-badge">
                              Correct Option: ({formatOptionKey(q.correct_option || q.correct_answer || '')})
                            </span>
                            <span className="sol-heading-text">Editorial Solution & Step-by-Step Proof</span>
                          </div>

                          <div className="solution-body">
                            {q.solution ? (
                              <MathRenderer content={q.solution} />
                            ) : (
                              <p className="no-sol-text">No detailed editorial solution text recorded.</p>
                            )}

                            {q.solution_image && (
                              <div className="sol-diagram-wrap">
                                <img
                                  src={q.solution_image}
                                  alt={`Solution diagram for Q${qNum}`}
                                  className="solution-diagram-img"
                                  onClick={() => onImageZoom(q.solution_image || '', `Solution ${qNum} Diagram`)}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: Student Printable Question Paper */}
          {studioTab === 'preview' && (
            <div className="studio-printable-container">
              <div className="print-toolbar hide-print">
                <span className="print-hint">
                  📄 Official Student Question Paper Format. Answers and solutions are completely hidden for test execution.
                </span>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-toolbar-print"
                >
                  <Printer size={14} />
                  <span>Print Student Paper (PDF)</span>
                </button>
              </div>

              <PaperPrintableDocument
                metadata={currentMetadata}
                questions={paperQuestions}
                mode="paper"
                onImageZoom={onImageZoom}
                optionFormat={optionFormat}
                columnsMode={columnsMode}
                optionsLayout={optionsLayout}
              />
            </div>
          )}

          {/* TAB 3: Teacher Solutions & Key Booklet */}
          {studioTab === 'solutions' && (
            <div className="studio-printable-container">
              <div className="print-toolbar hide-print">
                <span className="print-hint">
                  🔑 Teacher Evaluation & Step-by-Step Solutions Booklet with Quick Answer Matrix.
                </span>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-toolbar-print"
                >
                  <Printer size={14} />
                  <span>Print Solutions Booklet (PDF)</span>
                </button>
              </div>

              <PaperPrintableDocument
                metadata={currentMetadata}
                questions={paperQuestions}
                mode="solutions"
                onImageZoom={onImageZoom}
                optionFormat={optionFormat}
                columnsMode={columnsMode}
                optionsLayout={optionsLayout}
              />
            </div>
          )}
        </div>
      )}

      {examCreatorOpen && (
        <ExamCreatorModal paper={{ id: 'paper-generator-draft', title: examTitle, instituteName, class_std: selectedClass, subject: selectedSubject, timeAllowed, totalMarks, totalQuestions: paperQuestions.length, createdAt: '', updatedAt: '', questions: paperQuestions, instructions }} onClose={() => setExamCreatorOpen(false)} showToast={showToast} />
      )}
    </div>
  );
}
