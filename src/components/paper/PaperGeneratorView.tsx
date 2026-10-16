'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { 
  QuestionItem, 
  PaperMetadata, 
  PaperBlueprintConfig 
} from '@/types/paper';
import MathRenderer from '../MathRenderer';
import PaperPrintableDocument from './PaperPrintableDocument';
import EditTaggingModal from '../EditTaggingModal';
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
  Languages
} from 'lucide-react';

interface PaperGeneratorViewProps {
  classesList: string[];
  subjectsList: string[];
  topicsList: string[];
  onImageZoom: (url: string, title?: string) => void;
  showToast: (msg: string) => void;
  onNavigateToBank: () => void;
}

export default function PaperGeneratorView({
  classesList,
  subjectsList,
  topicsList,
  onImageZoom,
  showToast,
  onNavigateToBank,
}: PaperGeneratorViewProps) {
  // Active Studio Tab: editor | preview (student paper) | solutions (teacher key)
  const [studioTab, setStudioTab] = useState<'editor' | 'preview' | 'solutions'>('editor');

  // Paper Formatting Options
  const [optionFormat, setOptionFormat] = useState<'abcd' | '1234'>('abcd');
  const [columnsMode, setColumnsMode] = useState<'1-col' | '2-col'>('1-col');
  const [optionsLayout, setOptionsLayout] = useState<'2-col' | '4-col' | '1-col'>('2-col');

  // Generator Blueprint State
  const [selectedClass, setSelectedClass] = useState<string>(classesList[0] || 'Class 12');
  const [selectedSubject, setSelectedSubject] = useState<string>(subjectsList[0] || 'Physics');
  const [availableTopics, setAvailableTopics] = useState<string[]>(topicsList || []);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [chapterSearch, setChapterSearch] = useState<string>('');
  const [totalQuestions, setTotalQuestions] = useState<number>(25);
  const [timeAllowed, setTimeAllowed] = useState<string>('60 Mins');
  const [examTitle, setExamTitle] = useState<string>('Comprehensive Assessment Test 2026');
  const [instituteName, setInstituteName] = useState<string>('ARKE SCHOLARS ACADEMY');
  const [marksPerQuestion, setMarksPerQuestion] = useState<number>(4);
  const [negativeMarks, setNegativeMarks] = useState<number>(1);
  const [selectedLang, setSelectedLang] = useState<'all' | 'en' | 'hi'>('all');
  const [pyqOnly, setPyqOnly] = useState<boolean>(false);
  const [hasImageOnly, setHasImageOnly] = useState<boolean>(false);

  // Difficulty sliders (percentages)
  const [easyPct, setEasyPct] = useState<number>(30);
  const [medPct, setMedPct] = useState<number>(50);
  const [hardPct, setHardPct] = useState<number>(20);

  // Active Questions in Paper
  const [paperQuestions, setPaperQuestions] = useState<QuestionItem[]>([]);
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

  // Editing single question state via EditTaggingModal
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const [openSolutions, setOpenSolutions] = useState<Record<string | number, boolean>>({});

  // Load saved draft from localStorage on initial render
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem('arke_active_paper_draft');
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          setPaperQuestions(parsed.questions);
          if (parsed.examTitle) setExamTitle(parsed.examTitle);
          if (parsed.instituteName) setInstituteName(parsed.instituteName);
          if (parsed.timeAllowed) setTimeAllowed(parsed.timeAllowed);
          if (parsed.selectedClass) setSelectedClass(parsed.selectedClass);
          if (parsed.selectedSubject) setSelectedSubject(parsed.selectedSubject);
          if (parsed.instructions) setInstructions(parsed.instructions);
          if (parsed.optionFormat) setOptionFormat(parsed.optionFormat);
          if (parsed.columnsMode) setColumnsMode(parsed.columnsMode);
          if (parsed.optionsLayout) setOptionsLayout(parsed.optionsLayout);
        }
      }
    } catch (e) {
      console.warn('Failed to parse active draft', e);
    }
  }, []);

  // Sync draft to localStorage whenever paper changes
  useEffect(() => {
    if (paperQuestions.length > 0) {
      localStorage.setItem(
        'arke_active_paper_draft',
        JSON.stringify({
          questions: paperQuestions,
          examTitle,
          instituteName,
          timeAllowed,
          selectedClass,
          selectedSubject,
          instructions,
          optionFormat,
          columnsMode,
          optionsLayout,
        })
      );
    }
  }, [paperQuestions, examTitle, instituteName, timeAllowed, selectedClass, selectedSubject, instructions, optionFormat, columnsMode, optionsLayout]);

  // Load topics dynamically when class/subject changes
  useEffect(() => {
    async function fetchDynamicTopics() {
      try {
        const token = localStorage.getItem('arke_token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(
          `/api/filters?class_std=${encodeURIComponent(selectedClass)}&subject=${encodeURIComponent(selectedSubject)}`,
          { headers, credentials: 'include' }
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.topics) && data.topics.length > 0) {
            setAvailableTopics(data.topics);
            setSelectedTopics(data.topics);
          } else {
            setAvailableTopics([]);
            setSelectedTopics([]);
          }
        }
      } catch (err) {
        console.error('Error fetching topics:', err);
      }
    }
    fetchDynamicTopics();
  }, [selectedClass, selectedSubject]);

  // Filtered topics based on search input
  const filteredTopics = useMemo(() => {
    if (!chapterSearch.trim()) return availableTopics;
    const term = chapterSearch.toLowerCase().trim();
    return availableTopics.filter((t) => t.toLowerCase().includes(term));
  }, [availableTopics, chapterSearch]);

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
    setSelectedTopics((prev) =>
      prev.includes(topicName)
        ? prev.filter((t) => t !== topicName)
        : [...prev, topicName]
    );
  };

  const handleSelectAllTopics = () => setSelectedTopics([...availableTopics]);
  const handleClearAllTopics = () => setSelectedTopics([]);

  // Generate Paper API Call
  const handleGeneratePaper = async () => {
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
          topics: selectedTopics,
          totalQuestions,
          difficultyDistribution: {
            easy: easyPct,
            medium: medPct,
            hard: hardPct,
          },
          lang: selectedLang,
          hasImageOnly,
          pyqOnly,
          marksPerQuestion,
          negativeMarks,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate question paper from database');
      }

      if (Array.isArray(data.questions) && data.questions.length > 0) {
        setPaperQuestions(data.questions);
        setStudioTab('editor');
        showToast(`🎉 Generated Question Paper with ${data.questions.length} questions successfully!`);
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

  // Toggle Language of individual question (EN <-> HI)
  const handleToggleQuestionLang = (index: number) => {
    const updated = [...paperQuestions];
    const currentQ = updated[index];
    if (!currentQ) return;
    const newLang = currentQ.lang === 'hi' ? 'en' : 'hi';
    updated[index] = { ...currentQ, lang: newLang };
    setPaperQuestions(updated);
    showToast(`Question Q.${index + 1} language switched to ${newLang.toUpperCase()}`);
  };

  // Handle saved edit from EditTaggingModal
  const handleQuestionEdited = (updatedQ: any) => {
    setPaperQuestions((prev) =>
      prev.map((q) =>
        (q._id === updatedQ._id || q.id === updatedQ.id) ? { ...q, ...updatedQ } : q
      )
    );
    setEditingQuestion(null);
    showToast(`Question #${updatedQ.id} edited successfully in paper!`);
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
    const paperId = `paper_${Date.now()}`;
    const paperPayload = {
      id: paperId,
      title: examTitle,
      instituteName,
      class_std: selectedClass,
      subject: selectedSubject,
      timeAllowed,
      totalMarks: paperQuestions.reduce((s, q) => s + (Number(q.marks) || 4), 0),
      totalQuestions: paperQuestions.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      questions: paperQuestions,
      instructions,
      optionFormat,
      columnsMode,
      optionsLayout,
    };

    // 1. Save to Local Storage immediately
    try {
      const localList = JSON.parse(localStorage.getItem('arke_saved_papers') || '[]');
      const updatedList = [paperPayload, ...localList.filter((p: any) => p.id !== paperId)];
      localStorage.setItem('arke_saved_papers', JSON.stringify(updatedList));
    } catch (e) {
      console.warn('LocalStorage save failed', e);
    }

    // 2. Save to MongoDB
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
        showToast('💾 Paper saved successfully to Database and Local Storage!');
      } else {
        showToast('Paper saved locally.');
      }
    } catch (err) {
      showToast('Paper saved locally.');
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
    if (confirm('Are you sure you want to start a new question paper? Current draft will be cleared.')) {
      setPaperQuestions([]);
      localStorage.removeItem('arke_active_paper_draft');
      showToast('Paper cleared. Ready to generate a new paper.');
    }
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

  const currentMetadata: PaperMetadata = {
    title: examTitle,
    instituteName,
    class_std: selectedClass,
    subject: selectedSubject,
    timeAllowed,
    totalMarks,
    instructions,
    watermarkText: instituteName || 'ARKE SCHOLARS',
    showWatermark: true,
  };

  return (
    <div className="paper-generator-wrapper">
      {/* Top Paper Studio Navigation & Quick Actions Bar */}
      <div className="paper-studio-nav">
        <div className="studio-nav-left">
          <div className="studio-title-badge">
            <span className="studio-title-text">⚡ Question Paper Studio</span>
          </div>

          {paperQuestions.length > 0 && (
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
          {paperQuestions.length > 0 ? (
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

              <button
                type="button"
                onClick={handleResetPaper}
                className="btn-studio-action btn-reset-paper"
                title="Start a new paper"
              >
                <RotateCcw size={12} />
                <span>New Paper</span>
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* STATE 1: Blueprint Generator Form */}
      {paperQuestions.length === 0 ? (
        <div className="generator-wizard-container">
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
            <div className="wizard-card">
              <h3 className="card-heading">1. Target Class & Chapters</h3>

              <div className="form-fields-grid">
                <div className="form-field">
                  <label className="field-label">Target Class / Stream</label>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="wizard-select"
                  >
                    {classesList.map((cls) => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label className="field-label">Subject</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="wizard-select"
                  >
                    {subjectsList.map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
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
              </div>

              {/* Chapters Selector with Search */}
              <div className="topics-selection-box">
                <div className="topics-header-row">
                  <label className="field-label">
                    Select Target Chapters ({selectedTopics.length}/{availableTopics.length})
                  </label>
                  <div className="topics-quick-actions">
                    <button type="button" onClick={handleSelectAllTopics} className="btn-text-action">Select All</button>
                    <span className="dot-sep">•</span>
                    <button type="button" onClick={handleClearAllTopics} className="btn-text-action">Clear All</button>
                  </div>
                </div>

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
                    filteredTopics.map((top) => {
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
                </div>
              </div>
            </div>

            {/* Right Card: Question Blueprint & Difficulty */}
            <div className="wizard-card">
              <h3 className="card-heading">2. Question Count & Difficulty Balance</h3>

              <div className="form-fields-grid">
                <div className="form-field full-col">
                  <label className="field-label">Total Questions Count</label>
                  <div className="number-stepper-row">
                    {[15, 20, 25, 30, 45, 50, 75].map((cnt) => (
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
                        min={5}
                        max={180}
                        value={totalQuestions}
                        onChange={(e) => setTotalQuestions(parseInt(e.target.value, 10) || 25)}
                        className="custom-stepper-input"
                        title="Custom questions count"
                      />
                    </div>
                  </div>
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

                <div className="form-field">
                  <label className="field-label">Language</label>
                  <select
                    value={selectedLang}
                    onChange={(e) => setSelectedLang(e.target.value as any)}
                    className="wizard-select"
                  >
                    <option value="all">All Languages</option>
                    <option value="en">English (en)</option>
                    <option value="hi">Hindi (hi)</option>
                  </select>
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
                      onChange={(e) => setMedPct(parseInt(e.target.value, 10))}
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
                      onChange={(e) => setHardPct(parseInt(e.target.value, 10))}
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
                      : `⚡ Generate ${totalQuestions} Questions Paper`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* STATE 2: Interactive Paper Studio (Organize / Student Paper / Solutions) */
        <div className="paper-studio-container">
          {/* Paper Customization Toolbar (Options Style, Layout, Grid) */}
          <div className="paper-customization-toolbar hide-print">
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

                  return (
                    <div key={q._id || q.id || idx} className="question-card">
                      {/* Card Header matching exact Question Bank style */}
                      <div className="card-top-row">
                        <div className="card-left-badges">
                          <span className="q-index-pill">Q.{qNum}</span>
                          <span className="badge badge-subject">{q.subject || selectedSubject}</span>
                          <span className="badge badge-class">{q.class_std || selectedClass}</span>
                          {getDifficultyBadge(q.difficulty)}
                          {q.year && Number(q.year) > 0 ? (
                            <span className="badge badge-pyq">
                              <Calendar size={11} />
                              <span>PYQ {q.year}</span>
                            </span>
                          ) : null}
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

                          {/* Edit Question */}
                          <button
                            type="button"
                            onClick={() => setEditingQuestion(q)}
                            className="btn-card-action btn-edit-tag"
                            title="Edit question text, formula, options & solution"
                          >
                            <Pencil size={12} />
                            <span>Edit Question</span>
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

                      {/* Options Grid (2x2 or as customized) */}
                      {Array.isArray(q.options) && q.options.length > 0 && (
                        <div className={`options-grid ${optionsLayout === '4-col' ? 'grid-4-col' : optionsLayout === '1-col' ? 'grid-1-col' : ''}`}>
                          {q.options.map((opt) => {
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
                      )}

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

      {/* Edit Question Modal (Opens when teacher clicks 'Edit Question' on any question) */}
      {editingQuestion && (
        <EditTaggingModal
          question={editingQuestion}
          onClose={() => setEditingQuestion(null)}
          onSaved={handleQuestionEdited}
          availableClasses={classesList}
          availableSubjects={subjectsList}
        />
      )}
    </div>
  );
}
