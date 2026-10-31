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
import AiPaperStudioView from './AiPaperStudioView';
import ExamCreatorModal from '../exams/ExamCreatorModal';
import { QUESTION_TYPE_OPTIONS, resolveQuestionNegativeMarks, type QuestionType } from '@/lib/question-types';
import type { TenantBrand } from '@/lib/tenant';
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
  ShieldCheck,
  Minimize2,
} from 'lucide-react';

interface PaperGeneratorViewProps {
  classesList: string[];
  subjectsList: string[];
  topicsList: string[];
  onImageZoom: (url: string, title?: string) => void;
  showToast: (msg: string) => void;
  onNavigateToBank: () => void;
  paperId?: string;
  tenant: TenantBrand;
}

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

type TopicScope = {
  subject: string;
  topic: string;
};

type AssessmentTarget = 'school' | 'competitive';
type AssessmentType = 'viva' | 'chapter' | 'part' | 'full';
type CompetitiveExam = 'JEE Main' | 'JEE Advanced' | 'NEET';
type BlueprintPreset = 'balanced' | 'foundation' | 'advanced' | 'jee_main' | 'neet' | 'cbse';

const EXAM_CLASS_VALUE: Record<CompetitiveExam, string> = {
  'JEE Main': 'JM',
  'JEE Advanced': 'JA',
  NEET: 'NEET',
};

const COMPETITIVE_FORMATS: Record<CompetitiveExam, QuestionType[]> = {
  'JEE Main': ['all', 'mcq', 'numerical'],
  'JEE Advanced': ['all', 'mcq', 'numerical'],
  NEET: ['all', 'mcq'],
};

const difficultyBand = (difficulty: QuestionItem['difficulty']) => {
  const tier = Number(difficulty);
  if (tier <= 1) return `Easy · Tier ${Number.isFinite(tier) ? tier : 0} (Easy band: 0–1)`;
  if (tier === 2) return 'Moderate · Tier 2';
  if (tier === 3) return 'Tough · Tier 3';
  return 'Expert · Tier 4';
};

export default function PaperGeneratorView({
  classesList,
  subjectsList,
  topicsList,
  onImageZoom,
  showToast,
  onNavigateToBank,
  paperId,
  tenant,
}: PaperGeneratorViewProps) {
  const [studioSource, setStudioSource] = useState<'bank' | 'ai'>('bank');
  // Active Studio Tab: editor | preview (student paper) | solutions (teacher key)
  const [studioTab, setStudioTab] = useState<'editor' | 'preview' | 'solutions'>('editor');
  const [builderMode, setBuilderMode] = useState<'configure' | 'edit'>('configure');
  const [builderStep, setBuilderStep] = useState<1 | 2 | 3>(1);
  const [resetArmed, setResetArmed] = useState(false);

  // A blueprint starts with the assessment rule, not a loose collection of
  // fields. Competitive patterns lock their delivery rules; school tests keep
  // the teacher in control where the school pattern permits it.
  const [assessmentTarget, setAssessmentTarget] = useState<AssessmentTarget>('school');
  const [selectedBoard, setSelectedBoard] = useState('CBSE');
  const [selectedStateBoard, setSelectedStateBoard] = useState('UP Board');
  const [stateBoards, setStateBoards] = useState<string[]>(['UP Board', 'MP Board', 'Karnataka Board']);
  const [newStateBoard, setNewStateBoard] = useState('');
  const [stateBoardSaving, setStateBoardSaving] = useState(false);
  const [assessmentType, setAssessmentType] = useState<AssessmentType>('chapter');
  const [competitiveExam, setCompetitiveExam] = useState<CompetitiveExam>('JEE Main');

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
  const [topicSelections, setTopicSelections] = useState<TopicScope[]>([]);
  const [selectingFullSyllabus, setSelectingFullSyllabus] = useState(false);
  const [chapterSearch, setChapterSearch] = useState<string>('');
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [manualQuestionId, setManualQuestionId] = useState<string>('');
  const [addingQuestion, setAddingQuestion] = useState<boolean>(false);
  const [previewTopic, setPreviewTopic] = useState<string>('');
  const [previewSelectedScope, setPreviewSelectedScope] = useState(false);
  const [topicPreviewQuestions, setTopicPreviewQuestions] = useState<QuestionItem[]>([]);
  const [checkedPreviewIds, setCheckedPreviewIds] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewLoadingMore, setPreviewLoadingMore] = useState<boolean>(false);
  const [previewNextCursor, setPreviewNextCursor] = useState<string | null>(null);
  const [previewHasMore, setPreviewHasMore] = useState(false);
  const previewRequestController = useRef<AbortController | null>(null);
  const topicScopeRef = useRef<string>('');
  const multiSubjectPlanInitializedRef = useRef<string>('');
  const selectedSubjectsRef = useRef<string[]>(selectedSubjects);
  const [totalQuestions, setTotalQuestions] = useState<number>(25);
  const [timeAllowed, setTimeAllowed] = useState<string>('60 Mins');
  const [examTitle, setExamTitle] = useState<string>('Comprehensive Assessment Test 2026');
  const [instituteName, setInstituteName] = useState<string>(tenant.paperInstituteName);
  const [instituteLogoUrl, setInstituteLogoUrl] = useState<string>('');
  const [watermarkText, setWatermarkText] = useState<string>(tenant.portalName);
  const [showWatermark, setShowWatermark] = useState(true);
  const [paperBrandSaving, setPaperBrandSaving] = useState(false);
  const [marksPerQuestion, setMarksPerQuestion] = useState<number>(4);
  const [negativeMarks, setNegativeMarks] = useState<number>(1);
  const [selectedLang, setSelectedLang] = useState<'en' | 'hi'>('en');
  const [switchingLang, setSwitchingLang] = useState(false);
  const [pyqOnly, setPyqOnly] = useState<boolean>(false);
  const [hasImageOnly, setHasImageOnly] = useState<boolean>(false);
  const [questionType, setQuestionType] = useState<QuestionType>('all');
  const [availableQuestionTypes, setAvailableQuestionTypes] = useState<QuestionType[]>(['all']);
  const [selectedPreset, setSelectedPreset] = useState<BlueprintPreset | ''>('');
  // A teacher may intentionally clear the multi-subject scope. Keep that
  // choice through a taxonomy refresh instead of silently restoring all
  // available subjects.
  const hasSubjectSelectionBeenEditedRef = useRef(false);
  const taxonomyRequestRef = useRef(0);

  useEffect(() => {
    selectedSubjectsRef.current = selectedSubjects;
  }, [selectedSubjects]);

  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem('arke_token');
    void fetch('/api/profile/paper-brand', { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.profile || controller.signal.aborted) return;
        const profile = data.profile as { instituteName?: string; logoUrl?: string; watermarkText?: string; showWatermark?: boolean };
        if (profile.instituteName) setInstituteName(profile.instituteName);
        setInstituteLogoUrl(profile.logoUrl || '');
        setWatermarkText(profile.watermarkText || tenant.portalName);
        setShowWatermark(profile.showWatermark !== false);
      }).catch(() => undefined);
    return () => controller.abort();
  }, [tenant.portalName]);

  const isCompetitive = assessmentTarget === 'competitive';
  const activeBoardName = selectedBoard === 'State board' ? selectedStateBoard : selectedBoard;
  // Combined Part tests and Full-syllabus papers can span multiple subjects.
  // Competitive variants add official count/time rules on top of the same flow.
  const isMultiSubjectExam = assessmentType === 'part' || assessmentType === 'full';
  // JEE Advanced starts with the PCM scope selected, but faculty can tailor
  // the question-bank paper to a smaller subject scope when needed.
  const isJeeAdvancedPlan = isMultiSubjectExam && isCompetitive && competitiveExam === 'JEE Advanced';
  const hasLockedFullSyllabusSubjects = isCompetitive && assessmentType === 'full' && competitiveExam !== 'JEE Advanced';
  const minimumSubjectsForPart = 1;
  const selectedTopics = useMemo(
    () => [...new Set(topicSelections.map((selection) => selection.topic))],
    [topicSelections],
  );
  const selectedScopeGroups = useMemo(() => {
    const groups = new Map<string, number>();
    topicSelections.forEach(({ subject }) => groups.set(subject, (groups.get(subject) || 0) + 1));
    return [...groups.entries()].map(([subject, count]) => ({ subject, count }));
  }, [topicSelections]);
  // A persisted/returned plan can have selected chapters without an active
  // preview tab. Treat that state as a combined preview so the question pane
  // never falls back to an empty instruction screen.
  const isCombinedPreview = previewSelectedScope || (!previewTopic && topicSelections.length > 0);
  const activePreviewScopes = useMemo(() => {
    if (isCombinedPreview) return topicSelections;
    return previewTopic ? [{ subject: pickerSubject, topic: previewTopic }] : [];
  }, [isCombinedPreview, pickerSubject, previewTopic, topicSelections]);
  const activePreviewScopeKey = useMemo(
    () => activePreviewScopes.map((scope) => `${scope.subject}::${scope.topic}`).join('|'),
    [activePreviewScopes],
  );
  const hasPreviewScope = activePreviewScopes.length > 0;
  const eligibleSubjects = useMemo(() => {
    if (selectedClass === 'NEET') return availableSubjects.filter(subject => ['Physics', 'Chemistry', 'Biology'].includes(subject));
    if (['JM', 'JA', 'JEE Main', 'JEE Advanced'].includes(selectedClass)) return availableSubjects.filter(subject => ['Physics', 'Chemistry', 'Mathematics'].includes(subject));
    return availableSubjects;
  }, [selectedClass, availableSubjects]);

  // Covers a page restored while a combined plan is already selected
  // (including a hot refresh). Initialise it once per assessment/class/type;
  // later teacher removals remain respected.
  useEffect(() => {
    if (!isMultiSubjectExam || eligibleSubjects.length < 1) return;
    const planKey = `${assessmentTarget}|${competitiveExam}|${selectedClass}|${assessmentType}`;
    const shouldStartWithAllSubjects = isCompetitive || assessmentType === 'part';
    const initialSubjects = hasLockedFullSyllabusSubjects || shouldStartWithAllSubjects
      ? eligibleSubjects
      : eligibleSubjects.slice(0, 1);
    const lockedScopeNeedsSync = hasLockedFullSyllabusSubjects && (
      selectedSubjects.length !== initialSubjects.length || initialSubjects.some((subject) => !selectedSubjects.includes(subject))
    );
    if (lockedScopeNeedsSync) {
      setSelectedSubjects(initialSubjects);
      setSelectedSubject(initialSubjects[0]);
      setPickerSubject(initialSubjects[0]);
      return;
    }
    if (multiSubjectPlanInitializedRef.current === planKey) return;
    multiSubjectPlanInitializedRef.current = planKey;
    hasSubjectSelectionBeenEditedRef.current = false;
    if (initialSubjects.length && selectedSubjects.length === 0) {
      setSelectedSubjects(initialSubjects);
      setSelectedSubject(initialSubjects[0]);
      setPickerSubject(initialSubjects[0]);
    }
  }, [assessmentTarget, assessmentType, competitiveExam, eligibleSubjects, hasLockedFullSyllabusSubjects, isCompetitive, isMultiSubjectExam, selectedClass, selectedSubjects.length]);

  const assessmentRule = useMemo(() => {
    if (!isCompetitive) {
      return {
        locked: false,
        duration: null,
        count: null,
        formats: assessmentType === 'viva' ? (['mcq'] as QuestionType[]) : null,
        summary: assessmentType === 'viva'
          ? 'Viva uses objective questions. You choose the time and question count.'
          : assessmentType === 'full'
            ? 'Full-syllabus board paper keeps your chosen duration and question count. Select the complete syllabus in Step 2.'
            : 'You control duration, question count and chapter scope for this school assessment.',
      };
    }

    const subjectCount = Math.max(1, selectedSubjects.length);
    if (assessmentType === 'full') {
      const fullCount = competitiveExam === 'NEET' ? 180 : competitiveExam === 'JEE Main' ? 75 : 18 * subjectCount;
      const fullSummary = competitiveExam === 'JEE Advanced'
        ? `JEE Advanced full syllabus: 3 hours. PCM is selected by default; tailor the subject scope if required.`
        : `${competitiveExam} full syllabus: 3 hours and the official pattern are fixed.`;
      const fullFormats: QuestionType[] = competitiveExam === 'NEET' ? ['mcq'] : competitiveExam === 'JEE Main' ? ['all'] : COMPETITIVE_FORMATS[competitiveExam];
      return { locked: true, duration: '180 Mins', count: fullCount, formats: fullFormats, summary: fullSummary };
    }
    if (assessmentType === 'chapter') {
      const chapterCount = competitiveExam === 'NEET'
        ? (selectedSubject === 'Biology' ? 90 : 45)
        : competitiveExam === 'JEE Advanced' ? 18 : 25;
      return { locked: true, duration: '60 Mins', count: chapterCount, formats: COMPETITIVE_FORMATS[competitiveExam], summary: `${competitiveExam} chapter test rules are locked to the selected subject.` };
    }
    const minutes = competitiveExam === 'JEE Advanced'
      ? 180
      : subjectCount * 60;
    const perSubject = competitiveExam === 'NEET'
      ? selectedSubjects.reduce((sum, subject) => sum + (subject === 'Biology' ? 90 : 45), 0)
      : competitiveExam === 'JEE Advanced' ? 18 * subjectCount : 25 * subjectCount;
    return { locked: true, duration: `${minutes} Mins`, count: perSubject, formats: COMPETITIVE_FORMATS[competitiveExam], summary: competitiveExam === 'JEE Advanced' ? `JEE Advanced Part test: ${subjectCount} selected subject${subjectCount === 1 ? '' : 's'} · 18 questions per subject.` : `${competitiveExam} part test: ${subjectCount} selected subject${subjectCount === 1 ? '' : 's'} determine duration and count.` };
  }, [assessmentType, competitiveExam, isCompetitive, selectedSubject, selectedSubjects]);

  // Board/theory papers should not imply a penalty that their pattern does not
  // prescribe. JEE Main and NEET objective questions use the standard +4/−1
  // scoring model; the field is therefore shown only for those patterns.
  const supportsNegativeMarking = isCompetitive
    && (competitiveExam === 'JEE Main' || competitiveExam === 'NEET')
    && questionType !== 'subjective'
    && questionType !== 'true_false';

  useEffect(() => {
    if (!supportsNegativeMarking) {
      setNegativeMarks(0);
      return;
    }
    setNegativeMarks((current) => current > 0 ? current : 1);
  }, [supportsNegativeMarking]);

  const blueprintMissingRequirements = useMemo(() => {
    const missing: string[] = [];
    if (!selectedClass) missing.push('target class');
    if (!isCompetitive && !activeBoardName) missing.push('board');
    if (isCompetitive && !competitiveExam) missing.push('target exam');
    if (taxonomyLoading && eligibleSubjects.length === 0) missing.push('subjects to finish loading');
    else if (!selectedSubjects.length) missing.push('at least one subject');
    if (!examTitle.trim()) missing.push('exam title');
    if (!instituteName.trim()) missing.push('institute name');
    if (!assessmentRule.locked && (!Number.isFinite(totalQuestions) || totalQuestions < 1)) missing.push('question count');
    if (!assessmentRule.locked && !timeAllowed.trim()) missing.push('duration');
    return missing;
  }, [activeBoardName, assessmentRule.locked, competitiveExam, eligibleSubjects.length, examTitle, instituteName, isCompetitive, selectedClass, selectedSubjects.length, taxonomyLoading, timeAllowed, totalQuestions]);
  const isBlueprintComplete = blueprintMissingRequirements.length === 0;
  const hasRequiredChapterScope = assessmentType !== 'chapter' || topicSelections.length > 0;

  const goToQuestionPicker = () => {
    if (!isBlueprintComplete) {
      showToast(`Complete the blueprint first: ${blueprintMissingRequirements.join(', ')}.`);
      return;
    }
    setBuilderStep(2);
  };

  const patternOptions = useMemo(() => {
    const formats = assessmentRule.formats;
    const base = formats
      ? QUESTION_TYPE_OPTIONS.filter((item) => formats.includes(item.id))
      : QUESTION_TYPE_OPTIONS.filter((item) => availableQuestionTypes.includes(item.id));
    const cbseMaths = !isCompetitive && selectedBoard === 'CBSE' && selectedSubjects.includes('Mathematics');
    const withCbseNumerical = cbseMaths && !base.some((item) => item.id === 'numerical')
      ? [...base, QUESTION_TYPE_OPTIONS.find((item) => item.id === 'numerical')!]
      : base;
    // A taxonomy request can temporarily have no result while the teacher is
    // switching subject/class. Keep their explicit Blueprint choice visible;
    // do not quietly change MCQ-only into a mixed paper.
    if (!withCbseNumerical.some((item) => item.id === questionType)) {
      const selected = QUESTION_TYPE_OPTIONS.find((item) => item.id === questionType);
      return selected ? [selected, ...withCbseNumerical] : withCbseNumerical;
    }
    return withCbseNumerical;
  }, [assessmentRule.formats, availableQuestionTypes, isCompetitive, questionType, selectedBoard, selectedSubjects]);

  useEffect(() => {
    if (assessmentTarget !== 'school' || selectedBoard !== 'State board') return;
    const controller = new AbortController();
    const token = localStorage.getItem('arke_token');
    void fetch('/api/boards', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
      signal: controller.signal,
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.boards)) throw new Error(data.error || 'Could not load state boards.');
      setStateBoards(data.boards);
      if (!data.boards.includes(selectedStateBoard)) setSelectedStateBoard(data.boards[0] || 'UP Board');
    }).catch((error) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      showToast(error instanceof Error ? error.message : 'Could not load state boards.');
    });
    return () => controller.abort();
  }, [assessmentTarget, selectedBoard, selectedStateBoard, showToast]);

  const addStateBoard = async () => {
    const name = newStateBoard.trim();
    if (!name) return;
    setStateBoardSaving(true);
    try {
      const token = localStorage.getItem('arke_token');
      const response = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not add the state board.');
      const boardName = String(data.name || name);
      setStateBoards((current) => Array.from(new Set([...current, boardName])).sort());
      setSelectedStateBoard(boardName);
      setNewStateBoard('');
      showToast(`${boardName} is available for future papers.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not add the state board.');
    } finally {
      setStateBoardSaving(false);
    }
  };

  useEffect(() => {
    if (!assessmentRule.locked) return;
    if (assessmentRule.duration) setTimeAllowed(assessmentRule.duration);
    if (assessmentRule.count) setTotalQuestions(assessmentRule.count);
    if (assessmentRule.formats && !assessmentRule.formats.includes(questionType)) setQuestionType(assessmentRule.formats[0]);
  }, [assessmentRule, questionType]);

  const selectCompetitiveExam = (exam: CompetitiveExam) => {
    setAssessmentTarget('competitive');
    setCompetitiveExam(exam);
    setSelectedClass(EXAM_CLASS_VALUE[exam]);
    setSelectedSubjects([]);
    setSelectedSubject('');
    setAvailableSubjects([]);
    setAvailableTopics([]);
    setPickerSubject('');
    setTopicSelections([]);
    setPreviewTopic('');
    setTopicPreviewQuestions([]);
  };

  const selectSchoolTarget = () => {
    setAssessmentTarget('school');
    if (['NEET', 'JM', 'JA', 'JEE Main', 'JEE Advanced', 'Competitive Exam'].includes(selectedClass)) {
      const fallbackClass = availableClasses.find((item) => !['NEET', 'JM', 'JA', 'JEE Main', 'JEE Advanced', 'Competitive Exam'].includes(item)) || classesList[0] || 'Class 12';
      setSelectedClass(fallbackClass);
      setSelectedSubjects([]);
      setSelectedSubject('');
      setAvailableSubjects([]);
      setAvailableTopics([]);
      setPickerSubject('');
      setTopicSelections([]);
      setPreviewTopic('');
      setTopicPreviewQuestions([]);
    }
  };

  const selectAssessmentType = (type: AssessmentType) => {
    setAssessmentType(type);
    if (type !== 'part' && type !== 'full') return;

    // Part tests begin broad; a school full-syllabus paper starts with one
    // subject so it never silently turns into an all-subject paper.
    const combinedSubjects = eligibleSubjects.length ? eligibleSubjects : selectedSubjects;
    if (!combinedSubjects.length) return;
    const nextSubjects = isCompetitive || type === 'part' ? combinedSubjects : combinedSubjects.slice(0, 1);
    setSelectedSubjects(nextSubjects);
    setSelectedSubject(nextSubjects[0]);
    setPickerSubject(nextSubjects[0]);
  };

  // Exact percentage inputs are the source of truth. A 100% hard blueprint
  // must stay hard end-to-end; no slider is allowed to silently rebalance it.
  const [easyPct, setEasyPct] = useState<number>(30);
  const [medPct, setMedPct] = useState<number>(50);
  const [hardPct, setHardPct] = useState<number>(20);
  const includesExpertTier = !isCompetitive || competitiveExam === 'JEE Advanced';
  const difficultyTotal = easyPct + medPct + hardPct;
  const difficultyIsValid = difficultyTotal === 100;
  const updateDifficulty = (level: 'easy' | 'medium' | 'hard', rawValue: string) => {
    const value = Math.min(100, Math.max(0, Number.parseInt(rawValue, 10) || 0));
    if (level === 'easy') setEasyPct(value);
    if (level === 'medium') setMedPct(value);
    if (level === 'hard') setHardPct(value);
  };

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
  const [generationError, setGenerationError] = useState<{ message: string; available?: number; requested?: number } | null>(null);
  const [swappingId, setSwappingId] = useState<string | number | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [examCreatorOpen, setExamCreatorOpen] = useState(false);
  const [studioFocusMode, setStudioFocusMode] = useState(false);

  // Editing a completed paper is a focused faculty task. Default it to the
  // full-screen studio, while keeping an explicit exit control in the toolbar.
  useEffect(() => {
    if (builderMode === 'edit') setStudioFocusMode(true);
  }, [builderMode]);

  // Deep-linking a saved paper fetches its authoritative MongoDB document
  // after navigation, so Studio opens directly in final edit mode.
  useEffect(() => {
    if (!paperId) return;
    const controller = new AbortController();
    const loadPaperForEditing = async () => {
      try {
        const token = localStorage.getItem('arke_token');
        const response = await fetch(`/api/paper/saved/${encodeURIComponent(paperId)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
          signal: controller.signal,
          cache: 'no-store',
        });
        const data = await response.json();
        if (!response.ok || !data.paper) throw new Error(data.error || 'Could not load this saved paper.');
        if (controller.signal.aborted) return;
        const paper = data.paper as SavedPaper;
        setPaperQuestions(dedupeQuestions(paper.questions || []));
        setActivePaperId(paper.id);
        setActivePaperCreatedAt(paper.createdAt || null);
        setExamTitle(paper.title || 'Untitled paper');
        setInstituteName(paper.instituteName || tenant.paperInstituteName);
        setTimeAllowed(paper.timeAllowed || '60 Mins');
        setSelectedClass(paper.class_std || 'all');
        setSelectedSubject(paper.subject || 'all');
        setInstructions(paper.instructions || []);
        setBuilderMode('edit');
        setStudioTab('editor');
      } catch (error) {
        if (!controller.signal.aborted) showToast(error instanceof Error ? error.message : 'Could not load this saved paper.');
      }
    };
    void loadPaperForEditing();
    return () => controller.abort();
  }, [paperId]);

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
    // AI Studio has its own prompt-only source. Do not keep refreshing question
    // bank taxonomy in the background while the faculty member is composing an
    // AI brief.
    if (studioSource !== 'bank') return;
    const controller = new AbortController();
    const requestId = ++taxonomyRequestRef.current;
    async function fetchDynamicTopics() {
      // Keep the previous valid taxonomy visible during later filter changes.
      // Only the first load owns the full skeleton, preventing a distracting
      // loading flash after every subject, format, or scope adjustment.
      if (!selectedSubjectsRef.current.length) setTaxonomyLoading(true);
      setTaxonomyError('');
      try {
        const token = localStorage.getItem('arke_token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(
          `/api/filters?class_std=${encodeURIComponent(selectedClass)}&subject=${encodeURIComponent(pickerSubject)}&lang=${selectedLang}&withQuestions=true${isCompetitive ? '&format_scope=assessment' : ''}`,
          { headers, credentials: 'include', signal: controller.signal }
        );
        if (!res.ok) throw new Error('Could not load available subjects and chapters.');
        if (res.ok) {
          const data = await res.json();
          // A fast target/class switch may finish requests out of order. Only
          // the newest taxonomy response may change a blueprint choice.
          if (controller.signal.aborted || requestId !== taxonomyRequestRef.current) return;
          if (Array.isArray(data.classes) && data.classes.length > 0) {
            setAvailableClasses(data.classes);
            if (!data.classes.includes(selectedClass)) setSelectedClass(data.classes[0]);
          }
          if (Array.isArray(data.subjects)) {
            setAvailableSubjects(data.subjects);
            const returnedSubjects = data.subjects as string[];
            // The taxonomy response contains every subject that has questions.
            // Preserve a teacher's multi-subject Part-test selection instead of
            // reducing it to the minimum requirement whenever a subject tab
            // refreshes. On first load, seed a Part test with every valid
            // subject so the multi-select state is visible immediately.
            const eligible = selectedClass === 'NEET'
              ? returnedSubjects.filter((subject) => ['Physics', 'Chemistry', 'Biology'].includes(subject))
              : ['JM', 'JA', 'JEE Main', 'JEE Advanced'].includes(selectedClass)
                ? returnedSubjects.filter((subject) => ['Physics', 'Chemistry', 'Mathematics'].includes(subject))
                : returnedSubjects;
            const retainedSubjects = selectedSubjectsRef.current.filter((subject) => eligible.includes(subject));
            const nextSubjects = isMultiSubjectExam
              ? (retainedSubjects.length ? retainedSubjects : (hasSubjectSelectionBeenEditedRef.current ? [] : eligible))
              : (retainedSubjects.length ? [retainedSubjects[0]] : eligible.slice(0, 1));
            if (nextSubjects.join('|') !== selectedSubjectsRef.current.join('|')) setSelectedSubjects(nextSubjects);
            setSelectedSubject(nextSubjects[0] || '');
            if (!nextSubjects.includes(pickerSubject)) setPickerSubject(nextSubjects[0] || '');
          }
          if (Array.isArray(data.questionTypes)) {
            const nextTypes = data.questionTypes.filter((type: unknown): type is QuestionType =>
              QUESTION_TYPE_OPTIONS.some((option) => option.id === type),
            );
            setAvailableQuestionTypes(nextTypes.length ? nextTypes : ['all']);
            // Availability is informative only. The teacher-selected format is
            // the source of truth for preview and generation. Falling back to
            // "all" here caused MCQ-only blueprints to show mixed questions.
          }
          setShowAllTopics(false);
          const nextScope = `${selectedClass}|${selectedLang}`;
          const scopeChanged = Boolean(topicScopeRef.current) && topicScopeRef.current !== nextScope;
          topicScopeRef.current = nextScope;

          if (scopeChanged) {
            // A class or language change creates a new blueprint. Switching the
            // subject tab must not silently throw away chapters picked earlier.
            setTopicSelections([]);
            setPreviewTopic('');
            setPreviewSelectedScope(false);
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
  }, [studioSource, pickerSubject, selectedClass, selectedLang, isMultiSubjectExam, isCompetitive, isJeeAdvancedPlan]);

  // Filtered topics based on search input
  const filteredTopics = useMemo(() => {
    if (!chapterSearch.trim()) return availableTopics;
    const term = chapterSearch.toLowerCase().trim();
    return availableTopics.filter((t) => t.toLowerCase().includes(term));
  }, [availableTopics, chapterSearch]);
  const visibleTopics = useMemo(() => chapterSearch.trim() || showAllTopics ? filteredTopics : filteredTopics.slice(0, 18), [chapterSearch, filteredTopics, showAllTopics]);
  const noChapterDataForSubject = !taxonomyLoading && !taxonomyError && Boolean(pickerSubject) && availableTopics.length === 0;

  // Apply Blueprint Presets
  const applyPreset = (preset: BlueprintPreset) => {
    if (preset === 'balanced') {
      setAssessmentTarget('school');
      setAssessmentType('chapter');
      setTotalQuestions(25);
      setTimeAllowed('60 Mins');
      setMarksPerQuestion(4);
      setNegativeMarks(1);
      setEasyPct(30);
      setMedPct(50);
      setHardPct(20);
      setExamTitle(`${selectedSubject} Balanced Assessment`);
    } else if (preset === 'foundation') {
      setAssessmentTarget('school');
      setAssessmentType('chapter');
      setTotalQuestions(20);
      setTimeAllowed('45 Mins');
      setMarksPerQuestion(3);
      setNegativeMarks(0);
      setEasyPct(60);
      setMedPct(40);
      setHardPct(0);
      setExamTitle(`${selectedSubject} Foundation Concept Test`);
    } else if (preset === 'advanced') {
      setAssessmentTarget('competitive');
      setCompetitiveExam('JEE Advanced');
      setSelectedClass(EXAM_CLASS_VALUE['JEE Advanced']);
      setAssessmentType('chapter');
      setTotalQuestions(30);
      setTimeAllowed('90 Mins');
      setMarksPerQuestion(4);
      setNegativeMarks(2);
      setEasyPct(15);
      setMedPct(45);
      setHardPct(40);
      setExamTitle(`${selectedSubject} Advanced Ranker Test`);
    } else if (preset === 'jee_main') {
      setAssessmentTarget('competitive');
      setCompetitiveExam('JEE Main');
      setSelectedClass(EXAM_CLASS_VALUE['JEE Main']);
      setAssessmentType('chapter');
      setTotalQuestions(25);
      setTimeAllowed('60 Mins');
      setMarksPerQuestion(4);
      setNegativeMarks(1);
      setEasyPct(25);
      setMedPct(50);
      setHardPct(25);
      setExamTitle(`JEE Main Pattern Assessment - ${selectedSubject}`);
    } else if (preset === 'neet') {
      setAssessmentTarget('competitive');
      setCompetitiveExam('NEET');
      setSelectedClass(EXAM_CLASS_VALUE.NEET);
      setAssessmentType('chapter');
      setTotalQuestions(45);
      setTimeAllowed('45 Mins');
      setMarksPerQuestion(4);
      setNegativeMarks(1);
      setEasyPct(40);
      setMedPct(45);
      setHardPct(15);
      setExamTitle(`NEET Pattern Drill Mock - ${selectedSubject}`);
    } else if (preset === 'cbse') {
      setAssessmentTarget('school');
      setSelectedBoard('CBSE');
      setSelectedClass('Class 12');
      setAssessmentType('full');
      setSelectedSubjects(['Physics']);
      setSelectedSubject('Physics');
      setPickerSubject('Physics');
      setTopicSelections([]);
      setQuestionType('all');
      setTotalQuestions(35);
      setTimeAllowed('180 Mins');
      setMarksPerQuestion(3);
      setNegativeMarks(0);
      setEasyPct(45);
      setMedPct(45);
      setHardPct(10);
      setExamTitle('CBSE Board Pattern Mock - Physics');
    }
    setSelectedPreset(preset);
    showToast(`Loaded ${preset.toUpperCase()} blueprint pattern.`);
  };

  const handleToggleTopic = (topicName: string) => {
    const exists = topicSelections.some((selection) => selection.subject === pickerSubject && selection.topic === topicName);
    if (exists) {
      setPreviewTopic(topicName);
      setPreviewSelectedScope(false);
      return;
    }

    const nextSelections = [...topicSelections, { subject: pickerSubject, topic: topicName }];
    setTopicSelections(nextSelections);
    // The first chapter opens directly. Every additional chapter switches to
    // the combined scope so the teacher immediately reviews the real pool.
    setPreviewSelectedScope(nextSelections.length > 1);
    setPreviewTopic(nextSelections.length > 1 ? '' : topicName);
  };

  const handleInspectScope = (scope: TopicScope) => {
    setPickerSubject(scope.subject);
    setPreviewTopic(scope.topic);
    setPreviewSelectedScope(false);
  };

  const handleUnselectTopic = (scope: TopicScope) => {
    const nextSelections = topicSelections.filter((selection) => !(selection.subject === scope.subject && selection.topic === scope.topic));
    setTopicSelections(nextSelections);

    if (nextSelections.length > 1) {
      setPreviewSelectedScope(true);
      setPreviewTopic('');
    } else if (nextSelections.length === 1) {
      setPickerSubject(nextSelections[0].subject);
      setPreviewTopic(nextSelections[0].topic);
      setPreviewSelectedScope(false);
    } else {
      setPreviewTopic('');
      setPreviewSelectedScope(false);
      setTopicPreviewQuestions([]);
    }
    showToast(`${scope.topic} was removed from the selected scope. Questions already added to the paper remain unchanged.`);
  };

  const handleSelectAllTopics = () => {
    const retained = topicSelections.filter((selection) => selection.subject !== pickerSubject);
    const nextSelections = [...retained, ...availableTopics.map((topic) => ({ subject: pickerSubject, topic }))];
    setTopicSelections(nextSelections);
    setPreviewSelectedScope(nextSelections.length > 1);
    setPreviewTopic(nextSelections.length > 1 ? '' : nextSelections[0]?.topic || '');
  };
  const handleSelectFullSyllabus = async () => {
    if (!selectedSubjects.length) return showToast('Choose at least one subject first.');
    setSelectingFullSyllabus(true);
    try {
      const token = localStorage.getItem('arke_token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const responses = await Promise.all(selectedSubjects.map(async (subject) => {
        const query = new URLSearchParams({ class_std: selectedClass, subject, lang: selectedLang, withQuestions: 'true' });
        if (isCompetitive) query.set('format_scope', 'assessment');
        const response = await fetch(`/api/filters?${query.toString()}`, { headers, credentials: 'include' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Could not load chapters for ${subject}.`);
        return { subject, topics: Array.isArray(data.topics) ? data.topics as string[] : [] };
      }));
      const fullScope = responses.flatMap(({ subject, topics }) => topics.map((topic) => ({ subject, topic })));
      if (!fullScope.length) throw new Error('No chapters with questions are available for the selected full-syllabus plan.');
      setTopicSelections(fullScope);
      setPreviewTopic('');
      setPreviewSelectedScope(true);
      setPickerSubject(fullScope[0].subject);
      showToast(`Full syllabus selected: ${fullScope.length} chapters with available questions across ${selectedSubjects.length} subject${selectedSubjects.length === 1 ? '' : 's'}.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not select the full syllabus.');
    } finally {
      setSelectingFullSyllabus(false);
    }
  };
  const handleClearAllTopics = () => {
    setTopicSelections([]);
    setPreviewTopic('');
    setPreviewSelectedScope(false);
    setTopicPreviewQuestions([]);
  };
  const handleSubjectsDropdown = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const requested = Array.from(event.currentTarget.selectedOptions, (option) => option.value);
    const resolved = isMultiSubjectExam ? requested : requested.slice(-1);
    if (!resolved.length) return;
    if (isCompetitive && isMultiSubjectExam && resolved.length < minimumSubjectsForPart) {
      showToast(`${competitiveExam} ${assessmentType} papers need at least ${minimumSubjectsForPart} subject${minimumSubjectsForPart === 1 ? '' : 's'}.`);
      return;
    }
    const removedSubjects = selectedSubjects.filter((subject) => !resolved.includes(subject));
    if (removedSubjects.length) {
      setTopicSelections((selections) => selections.filter((selection) => !removedSubjects.includes(selection.subject)));
    }
    setSelectedSubjects(resolved);
    setSelectedSubject(resolved[0]);
    setPickerSubject(resolved[resolved.length - 1]);
    setPreviewTopic('');
    setPreviewSelectedScope(false);
  };

  const toggleSubjectCheckbox = (subject: string, checked: boolean) => {
    if (hasLockedFullSyllabusSubjects) {
      showToast(`${competitiveExam} full syllabus has an official fixed subject scope.`);
      return;
    }
    const next = checked
      ? Array.from(new Set([...selectedSubjects, subject]))
      : selectedSubjects.filter((item) => item !== subject);
    hasSubjectSelectionBeenEditedRef.current = true;
    if (!checked) {
      setTopicSelections((selections) => selections.filter((selection) => selection.subject !== subject));
    }
    setSelectedSubjects(next);
    setSelectedSubject(next[0]);
    setPickerSubject(checked ? subject : next[0]);
    setPreviewTopic('');
    setPreviewSelectedScope(false);
  };

  const selectAllSubjects = () => {
    if (hasLockedFullSyllabusSubjects) return;
    const next = [...eligibleSubjects];
    hasSubjectSelectionBeenEditedRef.current = true;
    setSelectedSubjects(next);
    setSelectedSubject(next[0] || '');
    setPickerSubject(next[0] || pickerSubject);
    setPreviewTopic('');
    setPreviewSelectedScope(false);
  };

  const clearAllSubjects = () => {
    if (hasLockedFullSyllabusSubjects) return;
    hasSubjectSelectionBeenEditedRef.current = true;
    setSelectedSubjects([]);
    setTopicSelections([]);
    setPreviewTopic('');
    setPreviewSelectedScope(false);
    setTopicPreviewQuestions([]);
  };

  const openBalanceStep = () => {
    if (assessmentType === 'chapter' && topicSelections.length === 0) {
      setBuilderStep(2);
      showToast('Choose at least one chapter in Step 2 before setting paper balance.');
      return;
    }
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
      setPaperQuestions(previous => [...previous, { ...candidate, marks: Number(candidate.marks) || marksPerQuestion, negative_marks: resolveQuestionNegativeMarks(candidate, negativeMarks) }]);
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
        negative_marks: resolveQuestionNegativeMarks(candidate, negativeMarks),
      } : question));
      setReplacementIndex(null);
      setBuilderMode('edit');
      setStudioTab('editor');
      showToast(`Question ${replacementIndex + 1} replaced with #${candidate.id}.`);
      return;
    }
    if (paperQuestions.length >= totalQuestions) return showToast(`This paper already has its target of ${totalQuestions} questions.`);
    setPaperQuestions(previous => [...previous, { ...candidate, marks: Number(candidate.marks) || marksPerQuestion, negative_marks: resolveQuestionNegativeMarks(candidate, negativeMarks) }]);
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
      setTopicSelections((previous) => previous.some((selection) => selection.subject === (currentQuestion.subject || pickerSubject) && selection.topic === chapter)
        ? previous
        : [...previous, { subject: currentQuestion.subject || pickerSubject, topic: chapter }]);
      setPreviewTopic(chapter);
      setPreviewSelectedScope(false);
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
        negative_marks: resolveQuestionNegativeMarks(question, negativeMarks),
      }));

    if (!additions.length) return showToast(`All visible questions from ${isCombinedPreview ? 'the selected scope' : 'this chapter'} are already in the paper.`);
    setPaperQuestions(previous => [...previous, ...additions]);
    showToast(`${additions.length} questions from ${isCombinedPreview ? 'the selected scope' : previewTopic} added. ${Math.max(0, totalQuestions - paperQuestions.length - additions.length)} slots remain.`);
  };

  const handleAddCheckedPreviewQuestions = () => {
    const remaining = Math.max(0, totalQuestions - paperQuestions.length);
    if (!remaining) return showToast(`This paper already has its target of ${totalQuestions} questions.`);
    const existingIds = new Set(paperQuestions.map(question => String(question._id || question.id)));
    const additions = topicPreviewQuestions
      .filter(question => checkedPreviewIds.includes(String(question._id || question.id)) && !existingIds.has(String(question._id || question.id)))
      .slice(0, remaining)
      .map(question => ({ ...question, marks: Number(question.marks) || marksPerQuestion, negative_marks: resolveQuestionNegativeMarks(question, negativeMarks) }));
    if (!additions.length) return showToast('Tick one or more new questions first.');
    setPaperQuestions(previous => [...previous, ...additions]);
    setCheckedPreviewIds([]);
    showToast(`${additions.length} selected questions added to the paper.`);
  };

  const handleFillFromPreviewTopic = async () => {
    if (!hasPreviewScope) return;
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
          topics: activePreviewScopes.map((scope) => scope.topic),
          scopes: activePreviewScopes,
          totalQuestions: remaining, lang: selectedLang,
          difficultyDistribution: { easy: easyPct, medium: medPct, hard: hardPct },
          hasImageOnly, pyqOnly, questionType, marksPerQuestion, negativeMarks,
          assessmentTarget, assessmentType, competitiveExam,
          enforceAssessmentRule: false,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not add questions from this chapter.');
      const existingIds = new Set(paperQuestions.map(question => String(question._id || question.id)));
      const additions = (data.questions || []).filter((question: QuestionItem) => !existingIds.has(String(question._id || question.id)));
      if (!additions.length) throw new Error('No new questions were found in this chapter.');
      setPaperQuestions(previous => [...previous, ...additions]);
      showToast(`${additions.length} questions from ${isCombinedPreview ? 'the selected chapters' : previewTopic} added to the paper.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not add questions from this chapter.');
    } finally { setGenerating(false); }
  };

  const handleRemovePreviewTopicQuestions = () => {
    if (!hasPreviewScope) return;
    const before = paperQuestions.length;
    const scopeKeys = new Set(activePreviewScopes.map((scope) => `${scope.subject}::${scope.topic}`));
    const remainingQuestions = paperQuestions.filter((question) => !scopeKeys.has(`${question.subject || ''}::${question.topic || ''}`));
    const removed = before - remainingQuestions.length;
    if (removed) setPaperQuestions(remainingQuestions);
    setTopicSelections((previous) => previous.filter((selection) => !scopeKeys.has(`${selection.subject}::${selection.topic}`)));
    if (!isCombinedPreview) setPreviewTopic('');
    setCheckedPreviewIds([]);
    showToast(removed ? `Removed ${removed} questions from the selected scope.` : 'Selected chapter scope removed from the paper plan.');
  };

  const previewTopicQuestionCount = useMemo(
    () => {
      const scopeKeys = new Set(activePreviewScopes.map((scope) => `${scope.subject}::${scope.topic}`));
      return paperQuestions.filter((question) => scopeKeys.has(`${question.subject || ''}::${question.topic || ''}`)).length;
    },
    [activePreviewScopes, paperQuestions],
  );

  const loadTopicPreview = async (append = false) => {
    if (!hasPreviewScope || (append && !previewNextCursor)) return;
    previewRequestController.current?.abort();
    const controller = new AbortController();
    previewRequestController.current = controller;
    if (append) setPreviewLoadingMore(true);
    else setPreviewLoading(true);
    try {
      const token = localStorage.getItem('arke_token');
      const queryParams: Record<string, string> = {
        limit: '12', pagination: 'cursor', class_std: selectedClass, lang: selectedLang,
      };
      if (isCompetitive && ['JEE Main', 'NEET'].includes(competitiveExam)) queryParams.max_difficulty = '3';
      if (append && previewNextCursor) queryParams.cursor = previewNextCursor;
      if (questionType !== 'all') queryParams.question_type = questionType;
      const query = new URLSearchParams(queryParams);
      activePreviewScopes.forEach((scope) => query.append('scope', `${scope.subject}::${scope.topic}`));
      const response = await fetch(`/api/questions?${query}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const incoming = data.questions || [];
      setTopicPreviewQuestions((previous) => append ? dedupeQuestions([...previous, ...incoming]) : incoming);
      setPreviewNextCursor(data.nextCursor || null);
      setPreviewHasMore(Boolean(data.hasMore));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (!append) setTopicPreviewQuestions([]);
      showToast(error instanceof Error ? error.message : 'Could not load topic questions.');
    } finally {
      if (previewRequestController.current === controller) {
        setPreviewLoading(false);
        setPreviewLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    setCheckedPreviewIds([]);
    setPreviewNextCursor(null);
    setPreviewHasMore(false);
    if (!hasPreviewScope) { setTopicPreviewQuestions([]); return; }
    void loadTopicPreview();
  // Topic selection is explicit; this fetch is intentionally scoped to its latest selection.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePreviewScopeKey, competitiveExam, isCombinedPreview, isCompetitive, selectedClass, selectedLang, questionType]);

  // Generate Paper API Call
  const handleGeneratePaper = async () => {
    setGenerationError(null);
    if (assessmentType === 'chapter' && topicSelections.length === 0) {
      setBuilderStep(2);
      showToast('Generation is blocked: choose at least one chapter in Step 2 first.');
      return;
    }
    if (!difficultyIsValid) {
      showToast(`Difficulty split must total 100%. It is currently ${difficultyTotal}%.`);
      return;
    }
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
          scopes: topicSelections,
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
          assessmentTarget,
          assessmentType,
          competitiveExam,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setGenerationError({
          message: data.error || 'Failed to generate question paper from database.',
          available: Number.isFinite(Number(data.available)) ? Number(data.available) : undefined,
          requested: Number.isFinite(Number(data.requested)) ? Number(data.requested) : undefined,
        });
        return;
      }

      if (Array.isArray(data.questions) && data.questions.length > 0) {
        const existingIds = new Set(paperQuestions.map(question => String(question._id || question.id)));
        const additions = data.questions.filter((question: QuestionItem) => !existingIds.has(String(question._id || question.id)));
        if (!additions.length) throw new Error('Those generated questions are already in this paper. Change the filters or add a different topic.');
        setPaperQuestions(previous => [...previous, ...additions]);
        setStudioTab('editor');
        setBuilderMode('edit');
        if (data.partial) {
          setGenerationError({
            message: data.warning || 'One requested question is not available for the exact difficulty split. The available matching questions are ready for review.',
            available: Number(data.available) || additions.length,
            requested: totalQuestions,
          });
          showToast(`Added ${additions.length} matching questions. Review the paper and add the final slot manually if needed.`);
        } else {
          showToast(`🎉 Added ${additions.length} generated questions. Your paper now has ${paperQuestions.length + additions.length}/${totalQuestions} questions.`);
        }
      } else {
        throw new Error('No questions found matching criteria.');
      }
    } catch (err: any) {
      setGenerationError({ message: err?.message || 'Could not generate the paper. Please try again.' });
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
        negative_marks: resolveQuestionNegativeMarks(data.question, negativeMarks),
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
      brandName: tenant.portalName,
      brandLogoSrc: instituteLogoUrl || tenant.logoSrc,
      brandLogoWidth: tenant.logoWidth,
      brandLogoHeight: tenant.logoHeight,
      // The document identity belongs to the active portal. A teacher's
      // optional institute name remains in the paper heading, but must not
      // turn a Prepzo paper into an ARKE-branded/third-party watermark.
      watermarkText: watermarkText || tenant.portalName,
      showWatermark,
      footerText: tenant.paperFooterText,
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

  const savePaperBrand = async () => {
    if (!instituteName.trim()) return showToast('Enter an institute name before saving the paper identity.');
    setPaperBrandSaving(true);
    try {
      const token = localStorage.getItem('arke_token');
      const response = await fetch('/api/profile/paper-brand', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ instituteName, logoUrl: instituteLogoUrl, watermarkText, showWatermark }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save paper identity.');
      showToast('Paper identity saved to your teacher profile.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save paper identity.');
    } finally {
      setPaperBrandSaving(false);
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
    if (val === '0') return <span className="badge badge-diff-basic">Easy (Tier 0)</span>;
    if (val === '1') return <span className="badge badge-diff-easy">Easy (Tier 1)</span>;
    if (val === '2') return <span className="badge badge-diff-med">Moderate (Tier 2)</span>;
    if (val === '3') return <span className="badge badge-diff-hard">Tough (Tier 3)</span>;
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
  const reusedQuestionCount = paperQuestions.filter((question) => {
    const id = String(question._id || question.id || '');
    return Boolean((questionUsage[id] || questionUsage[String(question.id)] || []).length);
  }).length;
  const paperSubjectLabel = selectedSubjects.join(' + ');
  const printableSubjectLabel = isCompetitive ? competitiveExam : paperSubjectLabel;

  const currentMetadata: PaperMetadata = {
    title: examTitle,
    instituteName,
    class_std: selectedClass,
    subject: printableSubjectLabel,
    subjectLabel: isCompetitive ? 'Target Exam:' : undefined,
    timeAllowed,
    totalMarks,
    instructions,
    watermarkText: watermarkText || tenant.portalName,
    showWatermark,
    brandName: tenant.portalName,
    brandLogoSrc: instituteLogoUrl || tenant.logoSrc,
    brandLogoWidth: tenant.logoWidth,
    brandLogoHeight: tenant.logoHeight,
    footerText: tenant.paperFooterText,
  };

  const studioSourceTabs = (
    <nav className="paper-studio-source-tabs hide-print" aria-label="Paper creation source">
      <button type="button" className={studioSource === 'bank' ? 'active' : ''} onClick={() => setStudioSource('bank')}>
        <BookOpen size={16} /> Question Bank Studio
      </button>
      <button type="button" className={studioSource === 'ai' ? 'active' : ''} onClick={() => setStudioSource('ai')}>
        <Sparkles size={16} /> AI Paper Studio <span>Claude</span>
      </button>
    </nav>
  );

  if (studioSource === 'ai') {
    return (
      <div className="paper-generator-wrapper ai-paper-generator-wrapper">
        {studioSourceTabs}
        <AiPaperStudioView classesList={classesList} subjectsList={subjectsList} showToast={showToast} tenant={tenant} />
      </div>
    );
  }

  return (
    <div className={`paper-generator-wrapper ${studioFocusMode && builderMode === 'edit' ? 'studio-focus-mode' : ''}`}>
      {studioSourceTabs}
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
              {studioFocusMode && (
                <button
                  type="button"
                  onClick={() => setStudioFocusMode(false)}
                  className="btn-studio-action btn-exit-studio"
                  title="Return to the workspace navigation"
                >
                  <Minimize2 size={13} />
                  <span>Exit full studio</span>
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>}

      {/* STATE 1: Blueprint Generator Form */}
      {builderMode === 'configure' ? (
        <div className="generator-wizard-container" data-step={builderStep}>
          <div className="builder-steps" aria-label="Paper builder steps">
            <button type="button" className={builderStep === 1 ? 'active' : ''} onClick={() => setBuilderStep(1)}><em>01</em> Blueprint</button><i></i>
            <button type="button" className={builderStep === 2 ? 'active' : ''} onClick={goToQuestionPicker} disabled={!isBlueprintComplete} aria-describedby={!isBlueprintComplete ? 'blueprint-gate-help' : undefined}><em>02</em> Pick questions</button><i></i>
            <button type="button" className={builderStep === 3 ? 'active' : ''} onClick={openBalanceStep} disabled={!isBlueprintComplete} aria-describedby={!isBlueprintComplete ? 'blueprint-gate-help' : undefined}><em>03</em> Balance & build</button>
            <b>{paperQuestions.length} / {totalQuestions} selected</b>{paperQuestions.length > 0 && <button type="button" className="open-paper-button" onClick={() => { setBuilderMode('edit'); setStudioTab('editor'); }}>Open paper →</button>}
          </div>
          {!isBlueprintComplete && <p id="blueprint-gate-help" className="blueprint-gate-help" role="status"><b>Finish Blueprint to unlock the next steps.</b> Still needed: {blueprintMissingRequirements.join(', ')}.</p>}
          {/* Preset selector */}
          <div className="presets-bar">
            <label className="presets-bar-label" htmlFor="paper-preset">1-click preset</label>
            <select id="paper-preset" className="wizard-select preset-select" value={selectedPreset} onChange={(event) => { const preset = event.target.value as BlueprintPreset | ''; if (preset) applyPreset(preset); else setSelectedPreset(''); }}>
              <option value="" disabled>Choose a paper pattern…</option>
              <option value="balanced">⚡ Balanced — 25 Qs · 60 min</option>
              <option value="jee_main">🎯 JEE Main — 25 Qs · +4/−1</option>
              <option value="neet">🩺 NEET Mock — 45 Qs</option>
              <option value="cbse">📖 CBSE Board — 35 Qs</option>
              <option value="foundation">🌱 Foundation — 20 Qs</option>
              <option value="advanced">🔥 Advanced — 30 Qs</option>
            </select>
            {selectedPreset && <span className="preset-applied-status" role="status"><CheckCircle2 size={15} /> Applied — you can still customise the blueprint below.</span>}
          </div>

          {/* Configuration Two-Column Grid */}
          <div className="wizard-form-grid">
            {/* Left Card: Target Class & Chapters */}
            <div className="wizard-card builder-selection-card">
              <h3 className="card-heading">{builderStep === 1 ? '1. Assessment blueprint' : '2. Chapters & question picker'}</h3>

              <div className="form-fields-grid blueprint-step step-one">
                <div className="blueprint-section-heading full-col"><span>Paper setup</span><small>Choose the assessment route, curriculum and test scope.</small></div>
                <div className="form-field full-col">
                  <label className="field-label">Assessment target</label>
                  <div className="blueprint-route-switch" aria-label="Assessment target">
                    <button type="button" className={assessmentTarget === 'school' ? 'active' : ''} onClick={selectSchoolTarget}>
                      <GraduationCap size={16} /> School & boards
                    </button>
                    <button type="button" className={assessmentTarget === 'competitive' ? 'active' : ''} onClick={() => selectCompetitiveExam(competitiveExam)}>
                      <Target size={16} /> Competitive exam
                    </button>
                  </div>
                </div>

                {assessmentTarget === 'school' ? <>
                  <div className="form-field full-col">
                    <label className="field-label" htmlFor="school-board">Board</label>
                    <select id="school-board" className="wizard-select" value={selectedBoard} onChange={(event) => setSelectedBoard(event.target.value)}>
                      <option value="CBSE">CBSE</option>
                      <option value="ICSE / ISC">ICSE / ISC</option>
                      <option value="State board">State board</option>
                    </select>
                    {selectedBoard === 'State board' && <div className="state-board-picker" aria-label="Choose state board">
                      <label htmlFor="state-board">State board</label>
                      <select id="state-board" className="wizard-select" value={selectedStateBoard} onChange={(event) => setSelectedStateBoard(event.target.value)}>{stateBoards.map((board) => <option key={board} value={board}>{board}</option>)}</select>
                      <div className="state-board-add">
                        <label htmlFor="new-state-board">Add state board</label>
                        <input id="new-state-board" value={newStateBoard} onChange={(event) => setNewStateBoard(event.target.value)} placeholder="e.g. Rajasthan Board" maxLength={60} />
                        <button type="button" onClick={() => void addStateBoard()} disabled={stateBoardSaving || !newStateBoard.trim()}>{stateBoardSaving ? 'Adding…' : 'Add board'}</button>
                      </div>
                    </div>}
                  </div>
                  <div className="form-field full-col">
                    <label className="field-label" htmlFor="target-class">Target class</label>
                    <select id="target-class" className="wizard-select" value={selectedClass} disabled={taxonomyLoading && availableClasses.length === 0} onChange={(event) => { setSelectedClass(event.target.value); setSelectedSubjects([]); setAvailableSubjects([]); setAvailableTopics([]); setPickerSubject(''); setPreviewTopic(''); setTopicPreviewQuestions([]); }}>
                      {taxonomyLoading && availableClasses.length === 0 ? <option>Loading available classes…</option> : availableClasses.filter((cls) => !['NEET', 'JM', 'JA', 'JEE Main', 'JEE Advanced', 'Competitive Exam'].includes(cls)).map((cls) => <option key={cls} value={cls}>{cls}</option>)}
                    </select>
                  </div>
                </> : <div className="form-field full-col">
                  <label className="field-label" htmlFor="target-exam">Target exam</label>
                  <select id="target-exam" className="wizard-select" value={competitiveExam} onChange={(event) => selectCompetitiveExam(event.target.value as CompetitiveExam)}>
                    <option value="JEE Main">JEE Main — Physics · Chemistry · Mathematics</option>
                    <option value="JEE Advanced">JEE Advanced — Physics · Chemistry · Mathematics</option>
                    <option value="NEET">NEET — Physics · Chemistry · Biology</option>
                  </select>
                </div>}

                <div className="form-field full-col">
                  <label className="field-label" htmlFor="test-type">Test type</label>
                  <select id="test-type" className="wizard-select" value={assessmentType} onChange={(event) => selectAssessmentType(event.target.value as AssessmentType)}>
                    {assessmentTarget === 'school' && <option value="viva">Viva — objective oral assessment</option>}
                    <option value="chapter">Chapter test — one chapter or selected topics</option>
                    <option value="part">Part test — multiple chapters or subjects</option>
                    <option value="full">Full syllabus — whole course assessment</option>
                  </select>
                </div>

                <div className="blueprint-rule-note full-col" role="status">
                  <ShieldCheck size={17} />
                  <span><b>{isCompetitive ? `${competitiveExam} rules` : `${activeBoardName} pattern`}</b>{assessmentRule.summary}</span>
                </div>

                <div className="blueprint-section-heading full-col"><span>Test settings</span><small>Duration is saved once here and follows this paper through every step.</small></div>
                <div className="form-field full-col duration-setting-card">
                  <div className="field-row-label"><label className="field-label">Class time / duration</label><span>{assessmentRule.locked ? 'Set by the selected exam pattern' : 'Choose a standard slot or enter a custom duration'}</span></div>
                  {assessmentRule.locked ? (
                    <>
                      <input type="text" value={timeAllowed} className="wizard-input" disabled aria-describedby="rule-duration-help" />
                      <small id="rule-duration-help" className="rule-lock-help">Locked by the selected assessment pattern</small>
                    </>
                  ) : (
                    <div className="time-slot-control">
                      <div className="time-slot-grid" role="group" aria-label="Choose class duration">
                        {[
                          ['60 Mins', '1 hour'],
                          ['120 Mins', '2 hours'],
                          ['180 Mins', '3 hours'],
                        ].map(([value, label]) => (
                          <button key={value} type="button" onClick={() => setTimeAllowed(value)} className={timeAllowed === value ? 'active' : ''}>{label}</button>
                        ))}
                      </div>
                      <label className="custom-duration-field">Custom duration
                        <input type="text" value={timeAllowed} onChange={(e) => setTimeAllowed(e.target.value)} placeholder="e.g. 45 Mins" className="wizard-input" />
                      </label>
                    </div>
                  )}
                </div>

                <div className="blueprint-section-heading full-col"><span>Paper composition</span><small>Set subjects, format, title and delivery settings.</small></div>
                <div className="form-field full-col">
                  <div className="field-row-label">
                    <label className="field-label" htmlFor="paper-subjects">Subjects (select one or more)</label>
                    {isMultiSubjectExam && <div className="subject-selection-actions">
                      <span>Tick every subject you want in this paper</span>
                      {!hasLockedFullSyllabusSubjects && <><button type="button" onClick={selectAllSubjects} disabled={!eligibleSubjects.length || selectedSubjects.length === eligibleSubjects.length}>Select all</button>
                      <button type="button" onClick={clearAllSubjects} disabled={!selectedSubjects.length}>Clear selection</button></>}
                    </div>}
                  </div>
                  {taxonomyLoading && eligibleSubjects.length === 0 ? <span className="subject-loading-skeleton" aria-label="Loading subjects with questions"><i /><i /><i /></span> : isMultiSubjectExam ? <fieldset className="subject-checkbox-grid" aria-label="Subjects to include">
                    {eligibleSubjects.map((subject) => {
                      const selected = selectedSubjects.includes(subject);
                      return <label key={subject} className={`subject-checkbox ${selected ? 'is-selected' : ''}`}>
                        <input type="checkbox" checked={selected} disabled={hasLockedFullSyllabusSubjects} onChange={(event) => toggleSubjectCheckbox(subject, event.target.checked)} />
                        <span>{subject}</span>
                      </label>;
                    })}
                  </fieldset> : <select id="paper-subjects" className="wizard-select subject-select" value={selectedSubjects[0] || ''} onChange={handleSubjectsDropdown}>
                    {eligibleSubjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                  </select>}
                  {taxonomyLoading && eligibleSubjects.length > 0 && <span className="subjects-refreshing" role="status">Refreshing subjects…</span>}
                  {isMultiSubjectExam && selectedSubjects.length > 0 && (
                    <div className="subject-plan-summary" role="status">
                      <span className="subject-plan-label">{assessmentType === 'full' ? 'Full-syllabus plan' : 'Part-test plan'}</span>
                      <div className="subject-plan-chips">
                        {selectedSubjects.map((subject) => (
                          <span key={subject} className="subject-plan-chip">
                            {subject}
                            {isCompetitive && <b>{competitiveExam === 'NEET' ? (subject === 'Biology' ? '90 Qs' : '45 Qs') : competitiveExam === 'JEE Advanced' ? '18 Qs' : '25 Qs'}</b>}
                          </span>
                        ))}
                      </div>
                      <strong>{isCompetitive ? `${assessmentRule.count} questions · ${assessmentRule.duration}` : assessmentType === 'full' ? `${totalQuestions} questions · ${timeAllowed}` : `${selectedSubjects.length} subjects · set slots below`}</strong>
                    </div>
                  )}
                  {isJeeAdvancedPlan && isMultiSubjectExam && <p className="multi-subject-hint">PCM is selected by default for JEE Advanced. Untick any subject to tailor this paper.</p>}
                  {hasLockedFullSyllabusSubjects && <p className="multi-subject-hint">{competitiveExam} full syllabus uses its official subject scope, so these choices are locked.</p>}
                  {isMultiSubjectExam && !selectedSubjects.length && <p className="subject-selection-empty" role="status">No subject selected. Tick one or more subjects to continue.</p>}
                  {!isMultiSubjectExam && <p className="multi-subject-hint">Choose Part test or Full syllabus to select multiple subjects.</p>}
                  {!taxonomyLoading && taxonomyError && <p className="taxonomy-inline-state" role="status">{taxonomyError}</p>}
                  {!taxonomyLoading && !taxonomyError && eligibleSubjects.length === 0 && <p className="taxonomy-inline-state taxonomy-data-not-found" role="status"><b>Data not found.</b> No subjects with questions are available for this class and language. Change the Blueprint filters and try again.</p>}
                </div>

                <div className="form-field full-col">
                  <div className="field-row-label"><label className="field-label">Question pattern / format</label><span>Only formats valid for this assessment are shown</span></div>
                  <div className="pill-grid question-type-grid">
                    {patternOptions.map((item) => (
                      <button key={item.id} type="button" onClick={() => setQuestionType(item.id)} disabled={assessmentRule.locked && (assessmentRule.formats?.length || 0) === 1} className={`pill-option ${questionType === item.id ? 'active' : ''}`} title={item.title}>{item.label}</button>
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
                  <div className="paper-identity-grid">
                    <input
                      type="text"
                      value={instituteName}
                      onChange={(e) => setInstituteName(e.target.value)}
                      placeholder={`e.g. ${tenant.paperInstituteName}`}
                      className="wizard-input"
                    />
                    <input
                      type="url"
                      value={instituteLogoUrl}
                      onChange={(e) => setInstituteLogoUrl(e.target.value)}
                      placeholder="Institute logo URL (optional)"
                      className="wizard-input"
                    />
                  </div>
                  <div className="paper-identity-actions">
                    <label className="watermark-control"><input type="checkbox" checked={showWatermark} onChange={(event) => setShowWatermark(event.target.checked)} /> <span>Show watermark on this paper</span></label>
                    {showWatermark && <input type="text" value={watermarkText} onChange={(event) => setWatermarkText(event.target.value)} placeholder={tenant.portalName} className="wizard-input watermark-text-input" aria-label="Watermark text" />}
                    <button type="button" className="paper-brand-save" onClick={() => void savePaperBrand()} disabled={paperBrandSaving}>{paperBrandSaving ? 'Saving identity…' : 'Save as my paper identity'}</button>
                  </div>
                  <small className="rule-lock-help">Your institute name, logo URL and watermark preference are saved to this teacher profile for the next paper.</small>
                </div>

                <div className="form-field full-col">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="field-label" style={{ marginBottom: 0 }}>Target Paper Slots (कुल प्रश्न संख्या)</label>
                    <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>{assessmentRule.locked ? 'Set by assessment rules' : 'Sets slots for chapter fill & paper size'}</span>
                  </div>
                  <div className={`number-stepper-row ${assessmentRule.locked ? 'is-rule-locked' : ''}`}>
                    {[10, 15, 20, 25, 30, 35, 40, 45, 50, 75].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => !assessmentRule.locked && setTotalQuestions(cnt)}
                        disabled={assessmentRule.locked}
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
                        disabled={assessmentRule.locked}
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
                    Selected chapter scope ({topicSelections.length})
                  </label>
                  {topicSelections.length > 8 ? (
                    <div className="selected-scope-summary" role="status" aria-label={`${topicSelections.length} chapters selected`}>
                      <span>Full scope selected</span>
                      {selectedScopeGroups.map((group) => <button key={group.subject} type="button" onClick={() => { setPickerSubject(group.subject); setPreviewTopic(''); setPreviewSelectedScope(true); }}>{group.subject} <b>{group.count} chapters</b></button>)}
                      <small>Manage individual chapters from the subject list on the left.</small>
                    </div>
                  ) : topicSelections.length > 0 ? (
                    <div className="selected-scope-list selected-scope-inline" aria-label="Selected chapters">
                      {topicSelections.map((scope) => (
                        <div className="selected-scope-chip" key={`${scope.subject}::${scope.topic}`}>
                          <button type="button" onClick={() => handleInspectScope(scope)} title={`Inspect ${scope.subject} · ${scope.topic}`}>
                            <span>{scope.subject}</span>
                            <strong>{scope.topic}</strong>
                          </button>
                          <button
                            type="button"
                            className="selected-scope-remove"
                            onClick={() => handleUnselectTopic(scope)}
                            aria-label={`Unselect ${scope.topic} from ${scope.subject}`}
                            title={`Unselect ${scope.topic}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="topics-quick-actions">
                    {assessmentType === 'full' && <><button type="button" onClick={() => void handleSelectFullSyllabus()} className="btn-text-action" disabled={selectingFullSyllabus || noChapterDataForSubject}>{selectingFullSyllabus ? 'Selecting full syllabus…' : 'Select full syllabus'}</button><span className="dot-sep">•</span></>}
                    <button type="button" onClick={handleSelectAllTopics} className="btn-text-action" disabled={noChapterDataForSubject}>Select all {pickerSubject || 'chapters'}</button>
                    <span className="dot-sep">•</span>
                    <button type="button" onClick={handleClearAllTopics} className="btn-text-action">Clear All</button>
                    {topicSelections.length > 0 && <>
                      <span className="dot-sep">•</span>
                      <button
                        type="button"
                        onClick={() => { setPreviewSelectedScope(true); setPreviewTopic(''); }}
                        className="btn-text-action scope-preview-trigger"
                      >
                        View selected questions ({topicSelections.length})
                      </button>
                    </>}
                  </div>
                </div>

                <div className="chapter-question-split">
                  <aside className="chapter-list-panel" aria-label="Chapter list">
                    <div className="picker-subject-tabs" aria-label="Subjects with available questions">
                      {(isMultiSubjectExam ? selectedSubjects : [selectedSubject]).map((subject) => <button key={subject} type="button" className={pickerSubject === subject && !isCombinedPreview ? 'active' : ''} onClick={() => { setPickerSubject(subject); setPreviewTopic(''); setPreviewSelectedScope(false); setTopicPreviewQuestions([]); }}>{subject}</button>)}
                    </div>
                    <p className="chapter-list-hint">Choose a subject, then a chapter. Its real questions and available sub-topics open on the right.</p>
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
                    taxonomyLoading ? <div className="no-topics-notice">Loading chapters from syllabus database...</div> : <div className="no-topics-notice no-topics-data-not-found"><b>Data not found</b><span>No chapters with usable questions exist for {pickerSubject || 'this subject'}.</span><button type="button" onClick={() => setBuilderStep(1)}>Edit Blueprint</button></div>
                  ) : filteredTopics.length === 0 ? (
                    <div className="no-topics-notice">No chapters matching &ldquo;{chapterSearch}&rdquo;</div>
                  ) : (
                    visibleTopics.map((top) => {
                      const isChecked = topicSelections.some((selection) => selection.subject === pickerSubject && selection.topic === top);
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
                    <div className="question-filter-title">
                      <span>{replacementIndex !== null ? 'REPLACE QUESTION' : 'QUESTION PICKER'}</span>
                      <h4>{replacementIndex !== null ? `Choose a replacement for Question ${replacementIndex + 1}${previewTopic ? ` · ${previewTopic}` : ''}` : isCombinedPreview ? `Questions from ${topicSelections.length} selected chapters` : previewTopic ? `${pickerSubject} · ${previewTopic}` : 'Choose a chapter to inspect questions'}</h4>
                    </div>
                    {hasPreviewScope && <div className="picker-format-lock" role="status" aria-label="Question format selected in Blueprint">
                      <span>FORMAT</span>
                      <b>{QUESTION_TYPE_OPTIONS.find((item) => item.id === questionType)?.label || 'Mix All Types'}</b>
                      <small>Set in Blueprint</small>
                      <button type="button" onClick={() => setBuilderStep(1)}>Change</button>
                    </div>}
                    <div className="topic-preview-actions">
                      <div className="slots-inline-bar slots-readonly" title="Target slots set in Blueprint">
                        <span className="slots-inline-label">Target Slots:</span>
                        <b>{totalQuestions}</b><small>Set in Blueprint</small>
                        <button type="button" onClick={() => setBuilderStep(1)}>Change</button>
                      </div>
                      {replacementIndex === null && checkedPreviewIds.length > 0 && <button type="button" className="add-topic-preview" onClick={handleAddCheckedPreviewQuestions}>Add checked ({checkedPreviewIds.length})</button>}
                      {replacementIndex === null && hasPreviewScope && <button type="button" className="fill-topic-preview" onClick={() => void handleFillFromPreviewTopic()} disabled={generating || paperQuestions.length >= totalQuestions}>{generating ? 'Adding…' : `${isCombinedPreview ? 'Fill selected scope' : 'Add chapter'} · ${Math.max(0, totalQuestions - paperQuestions.length)} slots`}</button>}
                      {replacementIndex === null && hasPreviewScope && <button type="button" className="remove-topic-preview" onClick={handleRemovePreviewTopicQuestions}>Remove {isCombinedPreview ? 'selected scope' : 'chapter'}{previewTopicQuestionCount ? ` (${previewTopicQuestionCount})` : ''}</button>}
                      {replacementIndex !== null && <button type="button" className="fill-topic-preview" onClick={() => { setReplacementIndex(null); setBuilderMode('edit'); setStudioTab('editor'); }}>Cancel replace</button>}
                      {hasPreviewScope && replacementIndex === null && <button type="button" onClick={() => { setPreviewTopic(''); setPreviewSelectedScope(false); }}>Close</button>}
                    </div>
                  </div>
                  {!hasPreviewScope ? noChapterDataForSubject ? <div className="topic-picker-empty"><Filter size={22}/><b>Data not found</b><span>No chapters with usable questions are available for {pickerSubject}. Edit Blueprint to choose another class, language or subject.</span><button type="button" className="empty-state-action" onClick={() => setBuilderStep(1)}>Edit Blueprint</button></div> : <div className="topic-picker-empty"><BookOpen size={22}/><b>{replacementIndex !== null ? 'Choose a chapter for the replacement' : 'Select a chapter to start'}</b><span>Choose a subject, then a chapter. Use “View selected questions” to inspect all selected chapters together.</span></div> : previewLoading ? <div className="topic-picker-empty"><RefreshCw size={20} className="spin-icon"/><b>Loading scope questions</b><span>Fetching the matching {selectedLang === 'hi' ? 'Hindi' : 'English'} records.</span></div> : topicPreviewQuestions.length === 0 ? <div className="topic-picker-empty"><Filter size={22}/><b>Data not found</b><span>No questions match this chapter, language or question format. Change a filter or select another chapter.</span></div> : <><div className="topic-preview-list">{topicPreviewQuestions.map((question, index) => {
                    const questionKey = String(question._id || question.id);
                    const isAdded = paperQuestions.some(item => String(item._id || item.id) === questionKey);
                    const isChecked = checkedPreviewIds.includes(questionKey);
                    return <article className="topic-preview-card" key={questionKey}>
                      <header>
                        <div><b>Question {index + 1}</b><span>#{question.id}</span></div>
                        <span className="topic-tier">{question.difficulty !== undefined && question.difficulty !== null ? difficultyBand(question.difficulty) : 'Difficulty pending'}</span>
                        <label className="picker-check"><input type="checkbox" checked={isChecked} disabled={isAdded || replacementIndex !== null} onChange={() => setCheckedPreviewIds(previous => previous.includes(questionKey) ? previous.filter(id => id !== questionKey) : [...previous, questionKey])}/><span>Select</span></label>
                      </header>
                      <MathRenderer content={question.question} className="topic-question-stem" />
                      {question.question_image && <img src={question.question_image} alt="Question diagram" className="topic-question-image" onClick={() => onImageZoom(question.question_image!, `Question ${question.id} diagram`)} />}
                      <div className="topic-preview-meta">{question.question_image && <span>Diagram included</span>}<span>{question.subject || selectedSubject}</span>{question.topic && <span>{question.topic}</span>}{question.sub_topic && <span>{question.sub_topic}</span>}</div>
                      <div className="topic-preview-review" aria-label="Answer preview">
                        {question.options?.length ? <div className="topic-preview-options">
                          <span className="topic-review-label">Options</span>
                          {question.options.map((option) => {
                            const isCorrect = Boolean(question.correct_option || question.correct_answer) && [question.correct_option, question.correct_answer].some((answer) => answer?.toLowerCase() === option.key?.toLowerCase());
                            return <div key={option.key} className={isCorrect ? 'is-correct' : ''}>
                              <span>{formatOptionKey(option.key)}</span>
                              <div>{option.text && <MathRenderer content={option.text} inline />}{option.image && <img src={option.image} alt={`Option ${formatOptionKey(option.key)}`} onClick={() => onImageZoom(option.image!, `Option ${formatOptionKey(option.key)}`)} />}</div>
                              {isCorrect && <em>Answer</em>}
                            </div>;
                          })}
                        </div> : question.correct_answer ? <div className="topic-answer-key"><span>Correct answer</span><MathRenderer content={String(question.correct_answer)} inline /></div> : null}
                        {question.solution && <details className="topic-solution-preview"><summary>Solution</summary><MathRenderer content={question.solution} />{question.solution_image && <img src={question.solution_image} alt="Solution diagram" onClick={() => onImageZoom(question.solution_image!, `Solution ${question.id} diagram`)} />}</details>}
                      </div>
                      <button type="button" onClick={() => handleAddPreviewQuestion(question)} disabled={isAdded}>{isAdded ? <><Check size={14}/> Already in paper</> : replacementIndex !== null ? <><RefreshCw size={14}/> Use as replacement</> : <><Plus size={14}/> Add this question</>}</button>
                    </article>;
                  })}</div>{previewHasMore && <div className="topic-preview-more"><button type="button" onClick={() => void loadTopicPreview(true)} disabled={previewLoadingMore}>{previewLoadingMore ? 'Loading next questions…' : 'Load 12 more questions'}</button><span>Only a small matching batch is loaded at a time.</span></div>}</>}
                </div>
                  </section>
                </div>
              </div>
            </div>

            {/* Right Card: Question Blueprint & Difficulty */}
            <div className="wizard-card builder-blueprint-card blueprint-step step-three">
              <h3 className="card-heading">3. Paper balance & build</h3>

              <div className="form-fields-grid balance-top-grid">
                <div className="form-field balance-language-field">
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

                <div className={`form-field scoring-settings-card ${supportsNegativeMarking ? 'has-negative-marking' : ''}`}>
                  <div className="scoring-settings-heading">
                    <div><span>Scoring</span><b>{supportsNegativeMarking ? `+${marksPerQuestion} correct · −${negativeMarks} incorrect` : `+${marksPerQuestion} for each correct answer`}</b></div>
                    {!supportsNegativeMarking && <small>No negative marking for this paper pattern</small>}
                  </div>
                  <div className="scoring-settings-grid">
                    <label>
                      <span>Marks per correct answer</span>
                      <input
                        type="number"
                        min={1}
                        value={marksPerQuestion}
                        onChange={(e) => setMarksPerQuestion(parseInt(e.target.value, 10) || 4)}
                        className="wizard-input"
                      />
                    </label>
                    {supportsNegativeMarking && <label>
                      <span>Negative marks per incorrect answer</span>
                      <input
                        type="number"
                        min={0}
                        value={negativeMarks}
                        onChange={(e) => setNegativeMarks(parseInt(e.target.value, 10) || 0)}
                        className="wizard-input"
                      />
                    </label>}
                  </div>
                </div>

                <div className="form-field blueprint-readonly-summary" role="status">
                  <span>Question pattern</span>
                  <b>{QUESTION_TYPE_OPTIONS.find((item) => item.id === questionType)?.label || 'Mix All Types'}</b>
                  <button type="button" onClick={() => setBuilderStep(1)}>Edit blueprint</button>
                </div>

                <div className="form-field balance-filter-field">
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
                  <span className={`ratio-subtitle ${difficultyIsValid ? '' : 'ratio-total-invalid'}`} role="status">
                    Easy: {easyPct}% • Moderate: {medPct}% • Tough: {hardPct}%
                  </span>
                </div>

                <div className="difficulty-inputs" aria-label="Set exact difficulty percentages">
                  <p>Exact difficulty bands: Easy = Tier 0–1, Moderate = Tier 2, Tough = {includesExpertTier ? 'Tier 3–4' : 'Tier 3 only'}. The generator never substitutes another level.</p>
                  {([
                    ['easy', 'Easy (Tier 0–1)', easyPct],
                    ['medium', 'Moderate (Tier 2)', medPct],
                    ['hard', includesExpertTier ? 'Tough (Tier 3–4)' : 'Tough (Tier 3)', hardPct],
                  ] as const).map(([level, label, value]) => (
                    <label className={`difficulty-input difficulty-input-${level}`} key={level}>
                      <span>{label}</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        inputMode="numeric"
                        value={value}
                        onChange={(event) => updateDifficulty(level, event.target.value)}
                        aria-invalid={!difficultyIsValid}
                        aria-describedby="difficulty-total-help"
                      />
                      <b>%</b>
                    </label>
                  ))}
                  <span id="difficulty-total-help" className={`difficulty-total ${difficultyIsValid ? 'is-valid' : 'is-invalid'}`}>
                    Total: {difficultyTotal}%{difficultyIsValid ? ' — ready' : ' — adjust to 100%'}
                  </span>
                </div>

                <div className="ratio-visual-bar">
                  <div className="bar-seg seg-easy" style={{ width: `${easyPct}%` }}>Easy {easyPct}%</div>
                  <div className="bar-seg seg-med" style={{ width: `${medPct}%` }}>Moderate {medPct}%</div>
                  <div className="bar-seg seg-hard" style={{ width: `${hardPct}%` }}>Tough {hardPct}%</div>
                </div>

              </div>

              {/* Generate Button */}
              {generationError && <div className="generation-error" role="alert">
                <div><b>Generation could not be completed</b><span>{generationError.message}</span>{generationError.available !== undefined && generationError.requested !== undefined && <small>{generationError.available} matching questions are currently available; {generationError.requested} were requested.</small>}</div>
                <button type="button" onClick={() => setGenerationError(null)}>Dismiss</button>
              </div>}
              <div className="wizard-action-footer">
                <button
                  type="button"
                  onClick={handleGeneratePaper}
                  disabled={generating || !difficultyIsValid || !hasRequiredChapterScope}
                  className="btn-huge-generate"
                >
                  <Sparkles size={16} />
                  <span>
                    {generating
                      ? 'Generating from 5.27 Lakh Databank...'
                      : !difficultyIsValid
                      ? `Set difficulty total to 100% (${difficultyTotal}%)`
                      : !hasRequiredChapterScope
                      ? 'Choose a chapter in Step 2 first'
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
                    goToQuestionPicker();
                  }}
                  disabled={builderStep === 1 && !isBlueprintComplete}
                >
                  {builderStep === 1 ? 'Choose chapters' : 'Set paper balance'} <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  className="wizard-next-button wizard-generate-button"
                  onClick={() => void handleGeneratePaper()}
                  disabled={generating || !difficultyIsValid || !hasRequiredChapterScope}
                >
                  <Sparkles size={16} />
                  {generating
                    ? 'Building paper…'
                    : !difficultyIsValid
                    ? `Set difficulty total to 100% (${difficultyTotal}%)`
                    : !hasRequiredChapterScope
                    ? 'Choose a chapter in Step 2 first'
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
                <span className="stat-value">{totalMarks} (+{marksPerQuestion}{negativeMarks > 0 ? `/-${negativeMarks}` : ''})</span>
              </div>
              <div className={`stat-pill reuse-summary-pill ${reusedQuestionCount ? 'has-reuse' : ''}`} title={reusedQuestionCount ? 'Open question cards to replace or remove reused questions.' : 'No questions in this paper were found in saved papers or exams.'}>
                <span className="stat-label">Reuse check:</span>
                <span className="stat-value">{reusedQuestionCount ? `${reusedQuestionCount} used before` : 'All new'}</span>
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
                          <span className="crumb-marks">Marks: +{q.marks || marksPerQuestion} / -{q.negative_marks ?? resolveQuestionNegativeMarks(q, negativeMarks)}</span>
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
                <div className="print-hint">
                  <span>📄 Official Student Question Paper Format. Answers and solutions are completely hidden for test execution.</span>
                  <small>Opens your browser&apos;s Save as PDF dialog. Turn off browser headers and footers for a clean paper.</small>
                </div>
                <button
                  type="button"
                  onClick={() => handlePrint('paper')}
                  className="btn-toolbar-print"
                >
                  <Printer size={14} />
                  <span>Download student PDF</span>
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
                <div className="print-hint">
                  <span>🔑 Teacher Evaluation &amp; Step-by-Step Solutions Booklet with Quick Answer Matrix.</span>
                  <small>Opens your browser&apos;s Save as PDF dialog. Turn off browser headers and footers for a clean booklet.</small>
                </div>
                <button
                  type="button"
                  onClick={() => handlePrint('solutions')}
                  className="btn-toolbar-print"
                >
                  <Printer size={14} />
                  <span>Download solutions PDF</span>
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
