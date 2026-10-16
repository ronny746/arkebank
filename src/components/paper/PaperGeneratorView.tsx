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
  CheckSquare,
  Square,
  SlidersHorizontal,
  ChevronDown,
  Building2,
  PenTool
} from 'lucide-react';

interface PaperGeneratorViewProps {
  classesList: string[];
  subjectsList: string[];
  topicsList: string[];
  basketQuestions: QuestionItem[];
  onClearBasket: () => void;
  onImageZoom: (url: string, title?: string) => void;
  showToast: (msg: string) => void;
  onNavigateToBank: () => void;
}

export default function PaperGeneratorView({
  classesList,
  subjectsList,
  topicsList,
  basketQuestions,
  onClearBasket,
  onImageZoom,
  showToast,
  onNavigateToBank,
}: PaperGeneratorViewProps) {
  // Active Studio Tab
  const [studioTab, setStudioTab] = useState<'editor' | 'preview' | 'solutions'>('editor');

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
        })
      );
    }
  }, [paperQuestions, examTitle, instituteName, timeAllowed, selectedClass, selectedSubject, instructions]);

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
            // Default select all available topics
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

  // Apply Pre-configured Blueprint Presets
  const applyPreset = (preset: 'balanced' | 'foundation' | 'advanced' | 'jee_main' | 'neet' | 'cbse') => {
    if (preset === 'balanced') {
      setTotalQuestions(25);
      setTimeAllowed('60 Mins');
      setMarksPerQuestion(4);
      setNegativeMarks(1);
      setEasyPct(30);
      setMedPct(50);
      setHardPct(20);
      setExamTitle(`${selectedSubject} Balanced Unit Test`);
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
      setExamTitle(`${selectedSubject} Advanced Ranker Assessment`);
    } else if (preset === 'jee_main') {
      setTotalQuestions(25);
      setTimeAllowed('60 Mins');
      setMarksPerQuestion(4);
      setNegativeMarks(1);
      setEasyPct(25);
      setMedPct(50);
      setHardPct(25);
      setExamTitle(`JEE Main Pattern Mock Test - ${selectedSubject}`);
    } else if (preset === 'neet') {
      setTotalQuestions(45);
      setTimeAllowed('45 Mins');
      setMarksPerQuestion(4);
      setNegativeMarks(1);
      setEasyPct(40);
      setMedPct(45);
      setHardPct(15);
      setExamTitle(`NEET Pattern Speed Drill - ${selectedSubject}`);
    } else if (preset === 'cbse') {
      setTotalQuestions(35);
      setTimeAllowed('180 Mins');
      setMarksPerQuestion(3);
      setNegativeMarks(0);
      setEasyPct(45);
      setMedPct(45);
      setHardPct(10);
      setExamTitle(`CBSE Board Pattern Full Mock - ${selectedSubject}`);
    }
    showToast(`Loaded ${preset.toUpperCase()} blueprint pattern.`);
  };

  const setDifficultyPreset = (easy: number, med: number, hard: number) => {
    setEasyPct(easy);
    setMedPct(med);
    setHardPct(hard);
  };

  // Toggle single topic in selection
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

  // Load Basket Questions into Paper
  const handleLoadBasketQuestions = () => {
    if (basketQuestions.length === 0) {
      showToast('No questions currently in Paper Basket.');
      return;
    }
    setPaperQuestions([...basketQuestions]);
    setStudioTab('editor');
    showToast(`Loaded ${basketQuestions.length} questions from basket into Paper Studio!`);
  };

  // Reorder Questions (Move Up / Down)
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
      showToast(`🔄 Question Q${index + 1} swapped with fresh question!`);
    } catch (err: any) {
      showToast(`Swap failed: ${err.message}`);
    } finally {
      setSwappingId(null);
    }
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
        showToast('Paper saved locally (Server sync offline).');
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

  // Compute stats for current paper
  const totalMarks = paperQuestions.reduce((s, q) => s + (Number(q.marks) || 4), 0);
  const easyCount = paperQuestions.filter((q) => ['0', '1', 0, 1].includes(q.difficulty as any)).length;
  const medCount = paperQuestions.filter((q) => ['2', 2].includes(q.difficulty as any)).length;
  const hardCount = paperQuestions.filter((q) => ['3', '4', 3, 4].includes(q.difficulty as any)).length;

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
            <div className="sparkle-circle-icon">
              <Sparkles size={16} className="text-white" />
            </div>
            <div className="title-text-group">
              <span className="studio-title-text">Paper Generator Studio</span>
              <span className="studio-subtext-badge">5.27 Lakh Questions Active Engine</span>
            </div>
          </div>

          {paperQuestions.length > 0 && (
            <div className="studio-tabs-row hide-print">
              <button
                type="button"
                className={`studio-tab-btn ${studioTab === 'editor' ? 'active' : ''}`}
                onClick={() => setStudioTab('editor')}
              >
                <SlidersHorizontal size={14} />
                <span>1. Organize & Edit ({paperQuestions.length})</span>
              </button>
              <button
                type="button"
                className={`studio-tab-btn ${studioTab === 'preview' ? 'active' : ''}`}
                onClick={() => setStudioTab('preview')}
              >
                <Eye size={14} />
                <span>2. Student Paper (Printable)</span>
              </button>
              <button
                type="button"
                className={`studio-tab-btn ${studioTab === 'solutions' ? 'active' : ''}`}
                onClick={() => setStudioTab('solutions')}
              >
                <BookOpen size={14} />
                <span>3. Teacher Solutions & Key</span>
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
                <Save size={14} />
                <span>{saving ? 'Saving...' : 'Save Paper'}</span>
              </button>

              <button
                type="button"
                onClick={() => handlePrint('paper')}
                className="btn-studio-action btn-print-paper"
                title="Print student question paper"
              >
                <Printer size={14} />
                <span>Print Paper</span>
              </button>

              <button
                type="button"
                onClick={() => handlePrint('solutions')}
                className="btn-studio-action btn-print-sol"
                title="Print teacher solutions booklet"
              >
                <FileText size={14} />
                <span>Print Solutions</span>
              </button>

              <button
                type="button"
                onClick={handleResetPaper}
                className="btn-studio-action btn-reset-paper"
                title="Start a new paper"
              >
                <RotateCcw size={13} />
                <span>New Paper</span>
              </button>
            </>
          ) : (
            basketQuestions.length > 0 && (
              <button
                type="button"
                onClick={handleLoadBasketQuestions}
                className="btn-studio-action btn-load-basket"
              >
                <Plus size={14} />
                <span>Load {basketQuestions.length} Qs from Basket</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* STATE 1: Setup Blueprint Wizard */}
      {paperQuestions.length === 0 ? (
        <div className="generator-wizard-container">
          {/* Hero Banner with Sleek Mesh & Gradient */}
          <div className="wizard-hero-card">
            <div className="wizard-hero-left">
              <div className="hero-tag-pill">
                <Zap size={13} className="text-emerald" />
                <span>AI-Assisted Blueprint Assessment Engine</span>
              </div>
              <h2 className="hero-title">Create Perfect Exam Papers in Seconds</h2>
              <p className="hero-desc">
                Select your examination pattern, choose specific chapters or full syllabus, and customize difficulty. 
                Our high-speed engine intelligently draws high-yield, balanced questions without duplicates.
              </p>
            </div>

            {basketQuestions.length > 0 ? (
              <div className="basket-callout-card">
                <div className="basket-callout-info">
                  <span className="callout-count">{basketQuestions.length} Questions</span>
                  <span className="callout-text">Selected in your Question Basket</span>
                </div>
                <button
                  type="button"
                  onClick={handleLoadBasketQuestions}
                  className="btn-callout-load"
                >
                  <Plus size={14} />
                  <span>Build Paper with Basket</span>
                </button>
              </div>
            ) : (
              <div className="hero-quick-tip-card">
                <span className="tip-badge">PRO TIP</span>
                <p>Browse Question Bank anytime and click <b>+ Add to Paper</b> to cherry-pick questions manually!</p>
                <button type="button" onClick={onNavigateToBank} className="btn-tip-browse">
                  Browse Bank
                </button>
              </div>
            )}
          </div>

          {/* 1-Click Blueprint Presets */}
          <div className="wizard-section">
            <div className="section-label-row">
              <div className="label-with-icon">
                <Sparkles size={16} className="text-emerald" />
                <span className="section-label">1-Click Exam Presets</span>
              </div>
              <span className="section-subtext">Click any preset to instantly auto-configure blueprint pattern</span>
            </div>

            <div className="presets-grid">
              <button
                type="button"
                className="preset-pill-card preset-balanced"
                onClick={() => applyPreset('balanced')}
              >
                <div className="preset-icon-wrap icon-balanced">
                  <Zap size={18} />
                </div>
                <div className="preset-card-body">
                  <div className="preset-name">Balanced Unit Test</div>
                  <div className="preset-meta">25 Qs • 100 Marks • 60 Mins</div>
                  <div className="preset-tag">30% Easy • 50% Med • 20% Hard</div>
                </div>
              </button>

              <button
                type="button"
                className="preset-pill-card preset-jee"
                onClick={() => applyPreset('jee_main')}
              >
                <div className="preset-icon-wrap icon-jee">
                  <Target size={18} />
                </div>
                <div className="preset-card-body">
                  <div className="preset-name">JEE Main Pattern</div>
                  <div className="preset-meta">25 MCQs • 100 Marks • +4/-1</div>
                  <div className="preset-tag">Official NTA Pattern</div>
                </div>
              </button>

              <button
                type="button"
                className="preset-pill-card preset-neet"
                onClick={() => applyPreset('neet')}
              >
                <div className="preset-icon-wrap icon-neet">
                  <Stethoscope size={18} />
                </div>
                <div className="preset-card-body">
                  <div className="preset-name">NEET Drill Mock</div>
                  <div className="preset-meta">45 MCQs • 180 Marks • +4/-1</div>
                  <div className="preset-tag">Medical Speed Test</div>
                </div>
              </button>

              <button
                type="button"
                className="preset-pill-card preset-cbse"
                onClick={() => applyPreset('cbse')}
              >
                <div className="preset-icon-wrap icon-cbse">
                  <GraduationCap size={18} />
                </div>
                <div className="preset-card-body">
                  <div className="preset-name">CBSE Board Mock</div>
                  <div className="preset-meta">35 Qs • 70 Marks • 180 Mins</div>
                  <div className="preset-tag">Board Syllabus Focus</div>
                </div>
              </button>

              <button
                type="button"
                className="preset-pill-card preset-foundation"
                onClick={() => applyPreset('foundation')}
              >
                <div className="preset-icon-wrap icon-foundation">
                  <BookOpen size={18} />
                </div>
                <div className="preset-card-body">
                  <div className="preset-name">Foundation Builder</div>
                  <div className="preset-meta">20 Qs • 60 Marks • 45 Mins</div>
                  <div className="preset-tag">60% Easy • 40% Medium</div>
                </div>
              </button>

              <button
                type="button"
                className="preset-pill-card preset-advanced"
                onClick={() => applyPreset('advanced')}
              >
                <div className="preset-icon-wrap icon-advanced">
                  <Award size={18} />
                </div>
                <div className="preset-card-body">
                  <div className="preset-name">Advanced Challenger</div>
                  <div className="preset-meta">30 Qs • 120 Marks • +4/-2</div>
                  <div className="preset-tag">High Difficulty Drill</div>
                </div>
              </button>
            </div>
          </div>

          {/* Configuration Form Grid */}
          <div className="wizard-form-grid">
            {/* Card 1: Examination & Syllabus */}
            <div className="wizard-card">
              <div className="card-heading-row">
                <div className="card-heading-left">
                  <div className="card-icon-badge">
                    <PenTool size={16} />
                  </div>
                  <div>
                    <h3 className="card-heading">1. Target Class & Chapters</h3>
                    <p className="card-subhead">Choose target curriculum and syllabus coverage</p>
                  </div>
                </div>
              </div>

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
                  <label className="field-label">Exam Title & Purpose</label>
                  <input
                    type="text"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    placeholder="e.g. JEE Main Mock Assessment #1"
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

              {/* Enhanced Chapter / Topics Multi-Selector */}
              <div className="topics-selection-box">
                <div className="topics-header-row">
                  <div className="topics-title-group">
                    <label className="field-label">
                      Select Target Chapters ({selectedTopics.length}/{availableTopics.length})
                    </label>
                  </div>
                  <div className="topics-quick-actions">
                    <button type="button" onClick={handleSelectAllTopics} className="btn-text-action">
                      Select All
                    </button>
                    <span className="dot-sep">•</span>
                    <button type="button" onClick={handleClearAllTopics} className="btn-text-action">
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Chapter Search Box */}
                <div className="chapter-search-wrap">
                  <Search size={14} className="chapter-search-icon" />
                  <input
                    type="text"
                    placeholder="Search chapters (e.g. Optics, Mechanics, Thermodynamics)..."
                    value={chapterSearch}
                    onChange={(e) => setChapterSearch(e.target.value)}
                    className="chapter-search-input"
                  />
                  {chapterSearch && (
                    <button
                      type="button"
                      onClick={() => setChapterSearch('')}
                      className="chapter-search-clear"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="topics-chips-scroll">
                  {availableTopics.length === 0 ? (
                    <div className="no-topics-notice">
                      <Clock size={16} className="animate-spin text-muted" />
                      <span>Loading syllabus chapters from database...</span>
                    </div>
                  ) : filteredTopics.length === 0 ? (
                    <div className="no-topics-notice">
                      <span>No chapters found matching &ldquo;{chapterSearch}&rdquo;</span>
                    </div>
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
                          <span className="chip-indicator">
                            {isChecked ? <Check size={12} /> : <Plus size={12} />}
                          </span>
                          <span className="chip-text">{top}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Card 2: Question Blueprint & Distribution */}
            <div className="wizard-card">
              <div className="card-heading-row">
                <div className="card-heading-left">
                  <div className="card-icon-badge">
                    <Settings2 size={16} />
                  </div>
                  <div>
                    <h3 className="card-heading">2. Question Count & Difficulty</h3>
                    <p className="card-subhead">Control marks, time, and tier balance</p>
                  </div>
                </div>
              </div>

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
                  <label className="field-label">Question Source Toggles</label>
                  <div className="modern-toggles-grid">
                    <label className="modern-toggle-card">
                      <input
                        type="checkbox"
                        checked={pyqOnly}
                        onChange={(e) => setPyqOnly(e.target.checked)}
                        className="modern-toggle-input"
                      />
                      <div className="toggle-custom-switch"></div>
                      <div className="toggle-text-wrap">
                        <span className="toggle-main-title">PYQ Only</span>
                        <span className="toggle-sub-title">Only past competitive exam questions</span>
                      </div>
                    </label>

                    <label className="modern-toggle-card">
                      <input
                        type="checkbox"
                        checked={hasImageOnly}
                        onChange={(e) => setHasImageOnly(e.target.checked)}
                        className="modern-toggle-input"
                      />
                      <div className="toggle-custom-switch"></div>
                      <div className="toggle-text-wrap">
                        <span className="toggle-main-title">Diagrams Only</span>
                        <span className="toggle-sub-title">Only questions with visual diagrams</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Elevated Difficulty Ratio Breakdown */}
              <div className="difficulty-ratio-box">
                <div className="ratio-header-row">
                  <span className="ratio-title">Difficulty Distribution (Proportion)</span>
                  <div className="ratio-quick-presets">
                    <button
                      type="button"
                      onClick={() => setDifficultyPreset(30, 50, 20)}
                      className="btn-ratio-preset"
                    >
                      Balanced
                    </button>
                    <button
                      type="button"
                      onClick={() => setDifficultyPreset(60, 40, 0)}
                      className="btn-ratio-preset"
                    >
                      Foundation
                    </button>
                    <button
                      type="button"
                      onClick={() => setDifficultyPreset(15, 45, 40)}
                      className="btn-ratio-preset"
                    >
                      Advanced
                    </button>
                  </div>
                </div>

                {/* Visual Ratio Segment Bar */}
                <div className="ratio-visual-bar">
                  <div className="bar-seg seg-easy" style={{ width: `${easyPct}%` }}>
                    {easyPct > 12 && `Easy ${easyPct}%`}
                  </div>
                  <div className="bar-seg seg-med" style={{ width: `${medPct}%` }}>
                    {medPct > 12 && `Medium ${medPct}%`}
                  </div>
                  <div className="bar-seg seg-hard" style={{ width: `${hardPct}%` }}>
                    {hardPct > 12 && `Hard ${hardPct}%`}
                  </div>
                </div>

                <div className="ratio-sliders-row">
                  <div className="slider-item">
                    <div className="slider-meta-row">
                      <span className="slider-dot dot-easy"></span>
                      <span className="slider-label">Easy ({easyPct}%)</span>
                    </div>
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
                    <div className="slider-meta-row">
                      <span className="slider-dot dot-med"></span>
                      <span className="slider-label">Medium ({medPct}%)</span>
                    </div>
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
                    <div className="slider-meta-row">
                      <span className="slider-dot dot-hard"></span>
                      <span className="slider-label">Hard ({hardPct}%)</span>
                    </div>
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

              {/* Huge Radiant Generate Button */}
              <div className="wizard-action-footer">
                <button
                  type="button"
                  onClick={handleGeneratePaper}
                  disabled={generating}
                  className="btn-huge-generate"
                >
                  <Sparkles size={20} className={generating ? 'animate-spin' : 'animate-pulse'} />
                  <span>
                    {generating
                      ? 'Generating from 5.27 Lakh Databank...'
                      : `⚡ Generate ${totalQuestions} Questions Examination Paper`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* STATE 2: Interactive Paper Studio (Organize / Student Paper / Solutions) */
        <div className="paper-studio-container">
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
                <span className="stat-label">Total Qs:</span>
                <span className="stat-value">{paperQuestions.length}</span>
              </div>
              <div className="stat-pill">
                <span className="stat-label">Max Marks:</span>
                <span className="stat-value font-mono">
                  {totalMarks} (+{marksPerQuestion}/-{negativeMarks})
                </span>
              </div>
              <div className="stat-pill">
                <span className="stat-label">Tiers:</span>
                <span className="stat-value font-mono">
                  🟢 {easyCount} | 🟡 {medCount} | 🔴 {hardCount}
                </span>
              </div>
            </div>
          </div>

          {/* TAB 1: Editor & Reordering Workspace */}
          {studioTab === 'editor' && (
            <div className="studio-editor-view hide-print">
              <div className="editor-instructions-card">
                <div className="ins-header">
                  <div className="ins-title-row">
                    <PenTool size={15} className="text-emerald" />
                    <span>Live Question Paper Studio Controls:</span>
                  </div>
                  <button type="button" onClick={onNavigateToBank} className="btn-add-more-bank">
                    <Plus size={13} />
                    <span>Browse Question Bank to Add More</span>
                  </button>
                </div>
                <div className="ins-body">
                  Use <b>Move Up / Down</b> to resequence questions. Click <b>🔄 Swap Question</b> to instantly replace any question with another matching question from the same chapter without duplicates.
                </div>
              </div>

              {/* Questions List */}
              <div className="editor-questions-list">
                {paperQuestions.map((q, idx) => {
                  const qNum = idx + 1;
                  const isSwapping = swappingId === (q._id || q.id || idx);
                  const diffTier = String(q.difficulty || '2');

                  return (
                    <div
                      key={q._id || q.id || idx}
                      className={`editor-question-card tier-${diffTier}`}
                    >
                      {/* Card Header Line */}
                      <div className="card-top-row">
                        <div className="card-top-left">
                          <span className="q-sequence-badge">Q{qNum}</span>
                          <span className="q-id-tag">#{q.id}</span>
                          {q.topic && <span className="q-topic-tag">{q.topic}</span>}
                          {q.year && <span className="q-year-tag">{q.year}</span>}
                          <span className={`badge-diff-pill diff-${diffTier}`}>
                            {diffTier === '0' || diffTier === '1' ? 'Easy' : diffTier === '2' ? 'Medium' : 'Hard'}
                          </span>
                        </div>

                        {/* Reorder and Swap Controls */}
                        <div className="card-top-actions">
                          <button
                            type="button"
                            onClick={() => handleMoveQuestion(idx, 'up')}
                            disabled={idx === 0}
                            className="btn-order-action"
                            title="Move Question Up"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveQuestion(idx, 'down')}
                            disabled={idx === paperQuestions.length - 1}
                            className="btn-order-action"
                            title="Move Question Down"
                          >
                            <ArrowDown size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSwapQuestion(idx)}
                            disabled={isSwapping}
                            className="btn-swap-action"
                            title="Swap with similar question from bank"
                          >
                            <RefreshCw size={13} className={isSwapping ? 'animate-spin' : ''} />
                            <span>{isSwapping ? 'Swapping...' : 'Swap Question'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteQuestion(idx)}
                            className="btn-delete-action"
                            title="Remove from paper"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Question Body */}
                      <div className="card-q-body">
                        <MathRenderer content={q.question} />
                        {q.question_image && (
                          <div className="editor-diagram-wrap">
                            <img
                              src={q.question_image}
                              alt={`Question ${qNum} diagram`}
                              className="editor-diagram-img"
                              onClick={() => onImageZoom(q.question_image || '', `Question ${qNum} Diagram`)}
                            />
                          </div>
                        )}
                      </div>

                      {/* Options Grid */}
                      {Array.isArray(q.options) && (
                        <div className="card-options-compact-grid">
                          {q.options.map((opt) => {
                            const isCorrect = (
                              (q.correct_option && q.correct_option.toLowerCase() === opt.key?.toLowerCase()) ||
                              (q.correct_answer && q.correct_answer.toLowerCase() === opt.key?.toLowerCase())
                            );
                            return (
                              <div
                                key={opt.key}
                                className={`compact-opt-item ${isCorrect ? 'opt-correct' : ''}`}
                              >
                                <span className="opt-key">({opt.key?.toUpperCase()})</span>
                                {opt.text && <MathRenderer content={opt.text} inline />}
                                {opt.image && (
                                  <img
                                    src={opt.image}
                                    alt={`Option ${opt.key}`}
                                    className="opt-thumb-img"
                                    onClick={() => onImageZoom(opt.image || '', `Option (${opt.key})`)}
                                  />
                                )}
                                {isCorrect && <span className="badge-correct-indicator">✓ Correct</span>}
                              </div>
                            );
                          })}
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
                  <Printer size={15} />
                  <span>Print / Save as PDF (Student Paper)</span>
                </button>
              </div>

              <PaperPrintableDocument
                metadata={currentMetadata}
                questions={paperQuestions}
                mode="paper"
                onImageZoom={onImageZoom}
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
                  <Printer size={15} />
                  <span>Print / Save as PDF (Solutions Booklet)</span>
                </button>
              </div>

              <PaperPrintableDocument
                metadata={currentMetadata}
                questions={paperQuestions}
                mode="solutions"
                onImageZoom={onImageZoom}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
