'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Search, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  LogOut, 
  ImageIcon, 
  CheckCircle2, 
  HelpCircle,
  Filter,
  X,
  XCircle,
  FolderOpen,
  Database,
  LayoutDashboard,
  FilePlus2,
  Radio,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import DashboardView from '@/components/DashboardView';
import ExamManagementView from '@/components/exams/ExamManagementView';
import PaperGeneratorView from '@/components/paper/PaperGeneratorView';
import SavedPapersView from '@/components/paper/SavedPapersView';
import { SavedPaper } from '@/types/paper';
import LoginForm from '@/components/LoginForm';
import QuestionCard from '@/components/QuestionCard';
import ImageModal from '@/components/ImageModal';
import TaggingInspectorModal from '@/components/TaggingInspectorModal';
import EditTaggingModal from '@/components/EditTaggingModal';
import QuestionCardSkeleton from '@/components/QuestionCardSkeleton';
import SidebarFiltersSkeleton from '@/components/SidebarFiltersSkeleton';

type PortalView = 'dashboard' | 'bank' | 'generator' | 'saved' | 'exams';

const portalPath: Record<PortalView, string> = {
  dashboard: '/', bank: '/question-bank', generator: '/paper-generator', saved: '/saved-papers', exams: '/exams',
};

export default function Home({ initialTab = 'dashboard', paperId }: { initialTab?: PortalView; paperId?: string }) {
  const router = useRouter();
  // Authentication State
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Dynamic Taxonomy State from Database
  const [classesList, setClassesList] = useState<string[]>([]);
  const [subjectsList, setSubjectsList] = useState<string[]>([]);
  const [topicsList, setTopicsList] = useState<string[]>([]);
  const [subTopicsList, setSubTopicsList] = useState<string[]>([]);
  const [yearsList, setYearsList] = useState<number[]>([]);
  const [difficultiesList, setDifficultiesList] = useState<{ value: string; label: string }[]>([]);
  const [languagesList, setLanguagesList] = useState<{ value: string; label: string }[]>([]);
  const [totalDbCount, setTotalDbCount] = useState<number>(527562);
  const [filtersLoading, setFiltersLoading] = useState<boolean>(true);

  // Active Filter Controls (All cleanly managed in the Sidebar)
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [selectedSubTopic, setSelectedSubTopic] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedLang, setSelectedLang] = useState<string>('all');
  const [hasImageOnly, setHasImageOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');

  // Pagination & Feed State
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(15);
  const [questions, setQuestions] = useState<any[]>([]);
  const [totalQuestions, setTotalQuestions] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Modals & Feedback
  const [zoomImage, setZoomImage] = useState<{ url: string; title?: string } | null>(null);
  const [inspectedQuestion, setInspectedQuestion] = useState<any | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Paper Generator navigation. Saved paper payloads stay in MongoDB.
  const [activeNavTab, setActiveNavTab] = useState<PortalView>(initialTab);
  const [navCollapsed, setNavCollapsed] = useState(false);

  const navigate = (view: PortalView) => {
    setActiveNavTab(view);
    router.push(portalPath[view]);
  };

  const handleLoadSavedPaper = (paper: SavedPaper) => {
    setActiveNavTab('generator');
    router.push(`/paper-generator?paper=${encodeURIComponent(paper.id)}`);
    showToast(`Loaded "${paper.title}" into Paper Studio!`);
  };

  // Check saved session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('arke_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('arke_user');
        setUser(null);
      }
    } else {
      setUser(null);
    }
    setAuthChecked(true);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('arke_user');
    localStorage.removeItem('arke_token');
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setUser(null);
    showToast('Signed out of portal.');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Fetch dynamic filters from database
  const loadFilters = useCallback(async (currentClass: string, currentSubject: string, currentTopic: string) => {
    try {
      const params = new URLSearchParams();
      if (currentClass !== 'all') params.set('class_std', currentClass);
      if (currentSubject !== 'all') params.set('subject', currentSubject);
      if (currentTopic !== 'all') params.set('topic', currentTopic);

      const token = typeof window !== 'undefined' ? localStorage.getItem('arke_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/filters?${params.toString()}`, {
        headers,
        credentials: 'include',
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }

      const data = await res.json();

      if (data.classes) setClassesList(data.classes);
      if (data.subjects) setSubjectsList(data.subjects);
      if (data.topics) setTopicsList(data.topics);
      if (data.subTopics) setSubTopicsList(data.subTopics);
      if (data.years) setYearsList(data.years);
      if (data.difficulties) setDifficultiesList(data.difficulties);
      if (data.languages) setLanguagesList(data.languages);
      if (data.totalQuestions) setTotalDbCount(data.totalQuestions);
    } catch (err) {
      console.error('Failed to load dynamic filters:', err);
    } finally {
      setFiltersLoading(false);
    }
  }, []);

  // Reload filters whenever class/subject/topic changes
  useEffect(() => {
    if (user) {
      loadFilters(selectedClass, selectedSubject, selectedTopic);
    }
  }, [user, selectedClass, selectedSubject, selectedTopic, loadFilters]);

  // Fetch Questions
  const fetchQuestions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (selectedClass !== 'all') params.set('class_std', selectedClass);
      if (selectedSubject !== 'all') params.set('subject', selectedSubject);
      if (selectedTopic !== 'all') params.set('topic', selectedTopic);
      if (selectedSubTopic !== 'all') params.set('sub_topic', selectedSubTopic);
      if (selectedDifficulty !== 'all') params.set('difficulty', selectedDifficulty);
      if (selectedYear !== 'all') params.set('year', selectedYear);
      if (selectedLang !== 'all') params.set('lang', selectedLang);
      if (hasImageOnly) params.set('has_image', 'true');
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const token = typeof window !== 'undefined' ? localStorage.getItem('arke_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/questions?${params.toString()}`, {
        headers,
        credentials: 'include',
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch questions from database');
      }

      setQuestions(data.questions || []);
      setTotalQuestions(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      setError(err.message || 'Error connecting to database');
    } finally {
      setLoading(false);
    }
  }, [
    user,
    page,
    limit,
    selectedClass,
    selectedSubject,
    selectedTopic,
    selectedSubTopic,
    selectedDifficulty,
    selectedYear,
    selectedLang,
    hasImageOnly,
    searchQuery,
  ]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSelectedClass('all');
    setSelectedSubject('all');
    setSelectedTopic('all');
    setSelectedSubTopic('all');
    setSelectedDifficulty('all');
    setSelectedYear('all');
    setSelectedLang('all');
    setHasImageOnly(false);
    setSearchInput('');
    setSearchQuery('');
    setPage(1);
  };

  const handleQuestionSaved = (updatedQ: any) => {
    setQuestions((prev) =>
      prev.map((q) => (q._id === updatedQ._id || q.id === updatedQ.id ? { ...q, ...updatedQ } : q))
    );
    showToast(`Question #${updatedQ.id} updated successfully in database!`);
  };

  const activeFiltersCount = [
    selectedClass !== 'all',
    selectedSubject !== 'all',
    selectedTopic !== 'all',
    selectedSubTopic !== 'all',
    selectedDifficulty !== 'all',
    selectedYear !== 'all',
    selectedLang !== 'all',
    hasImageOnly,
    Boolean(searchQuery),
  ].filter(Boolean).length;

  if (!authChecked) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  // Strict Security Enforcement: Access denied without authenticated session
  if (!user) {
    return <LoginForm onSuccess={(u: any) => setUser(u)} />;
  }

  return (
    <div className="portal-wrapper">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="floating-toast">
          <CheckCircle2 size={16} className="text-emerald" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Global Header */}
      <header className="portal-header">
        <div className="header-left">
          <div className="header-brand">
            <Image
              src="/logo.png"
              alt="ARKE SCHOLARS Logo"
              width={65}
              height={50}
              className="brand-logo-img"
              priority
            />
            <div className="brand-text-col">
              <span className="brand-title">ARKE SCHOLARS</span>
              <span className="brand-subtitle">Question Bank & Assessment Intelligence</span>
            </div>
          </div>
          <div className="live-db-pill" title="Live MongoDB production connection">
            <span className="live-dot"></span>
            <span>{totalDbCount.toLocaleString()} Total Questions Live</span>
          </div>
        </div>

        {/* Question search appears only in the Bank workspace. */}
        {activeNavTab === 'bank' && <form noValidate onSubmit={handleSearchSubmit} className="header-search-form">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            placeholder="Search questions by formula, keywords, ID #280015, or slug..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="search-input"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                setSearchQuery('');
                setPage(1);
              }}
              className="search-clear-btn"
            >
              <X size={13} />
            </button>
          )}
        </form>}

        {/* User Session */}
        <div className="header-right">
          <div className="user-profile-badge">
            <div className="user-avatar-circle">{user?.email ? user.email[0].toUpperCase() : "A"}</div>
            <div className="user-info-text">
              <span className="user-email-text">{user.email}</span>
              <span className="user-role-text">Verified Faculty</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn-logout"
            title="Sign out of portal"
          >
            <LogOut size={14} />
            <span className="hide-mobile">Sign Out</span>
          </button>
        </div>
      </header>

      <div className={`portal-app-shell ${navCollapsed ? 'nav-collapsed' : ''}`}>
        <aside className="portal-side-nav" aria-label="Primary workspace navigation">
          <div className="side-nav-top"><div className="side-nav-label">WORKSPACE</div><button type="button" className="side-nav-toggle" onClick={() => setNavCollapsed(value => !value)} aria-label={navCollapsed ? 'Expand navigation' : 'Collapse navigation'} title={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}>{navCollapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}</button></div>
          <button className={activeNavTab === 'dashboard' ? 'active' : ''} onClick={() => navigate('dashboard')}><LayoutDashboard size={18}/><span>Dashboard</span></button>
          <button className={activeNavTab === 'bank' ? 'active' : ''} onClick={() => navigate('bank')}><Database size={18}/><span>Question bank</span></button>
          <button className={activeNavTab === 'generator' ? 'active' : ''} onClick={() => navigate('generator')}><FilePlus2 size={18}/><span>Paper studio</span></button>
          <button className={activeNavTab === 'saved' ? 'active' : ''} onClick={() => navigate('saved')}><FolderOpen size={18}/><span>Saved papers</span></button>
          <button className={activeNavTab === 'exams' ? 'active' : ''} onClick={() => navigate('exams')}><Radio size={18}/><span>Exams & tracking</span></button>
          <div className="side-nav-tip"><Radio size={15}/><span>Create a paper, publish its link, then track every attempt here.</span></div>
        </aside>
        <section className="portal-workspace">

      {activeNavTab === 'dashboard' && <DashboardView questionCount={totalDbCount} onNavigate={navigate} />}
      {activeNavTab !== 'dashboard' && activeNavTab !== 'exams' && <div className="workspace-context hide-print"><span>{activeNavTab === 'bank' ? 'Question bank' : activeNavTab === 'generator' ? 'Paper studio' : 'Saved papers'}</span></div>}

      {/* Mobile Top Bar with Filter Drawer Button */}
      {activeNavTab === 'bank' && (
        <>
          <div className="mobile-action-bar">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="btn-mobile-filter"
            >
              <Filter size={14} className="text-emerald" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="mobile-filter-badge">{activeFiltersCount}</span>
              )}
            </button>
            <div className="mobile-total-count">
              <span>{totalQuestions.toLocaleString()} Questions</span>
            </div>
          </div>

          {/* Main Dashboard Two-Column Layout */}
          <div className="portal-dashboard">
            {/* Left Sidebar: ALL Filters Cleanly Organized */}
            <aside className={`portal-sidebar ${mobileFiltersOpen ? "mobile-open" : ""}`}>
              <div className="sidebar-header">
                <div className="sidebar-title-row">
                  <Filter size={15} className="text-emerald" />
                  <span className="sidebar-title">All Filters & Taxonomy</span>
                </div>
                <div className="sidebar-header-actions">
                  {activeFiltersCount > 0 && (
                    <button onClick={handleResetFilters} className="btn-sidebar-reset">
                      <RotateCcw size={11} />
                      <span>Reset ({activeFiltersCount})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(false)}
                    className="btn-close-mobile-filters"
                    title="Close filters"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="sidebar-content">
                {filtersLoading ? (
                  <SidebarFiltersSkeleton />
                ) : (
                  <>
                {/* 1. Target Class / Stream */}
                <div className="filter-group">
                  <label className="filter-group-label">CLASS / EXAMINATION TARGET</label>
                  <div className="pill-grid">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClass('all');
                        setSelectedSubject('all');
                        setSelectedTopic('all');
                        setSelectedSubTopic('all');
                        setPage(1);
                      }}
                      className={`pill-option ${selectedClass === 'all' ? 'active' : ''}`}
                    >
                      All
                    </button>
                    {classesList.map((cls) => (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => {
                          setSelectedClass(cls);
                          setSelectedSubject('all');
                          setSelectedTopic('all');
                          setSelectedSubTopic('all');
                          setPage(1);
                        }}
                        className={`pill-option ${selectedClass === cls ? 'active' : ''}`}
                      >
                        {cls}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Subject Selection */}
                <div className="filter-group">
                  <label className="filter-group-label">SUBJECT</label>
                  <div className="pill-grid">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubject('all');
                        setSelectedTopic('all');
                        setSelectedSubTopic('all');
                        setPage(1);
                      }}
                      className={`pill-option ${selectedSubject === 'all' ? 'active' : ''}`}
                    >
                      All
                    </button>
                    {subjectsList.map((sub) => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => {
                          setSelectedSubject(sub);
                          setSelectedTopic('all');
                          setSelectedSubTopic('all');
                          setPage(1);
                        }}
                        className={`pill-option ${selectedSubject === sub ? 'active' : ''}`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Difficulty Level */}
                <div className="filter-group">
                  <label className="filter-group-label">DIFFICULTY LEVEL</label>
                  <div className="pill-grid">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDifficulty('all');
                        setPage(1);
                      }}
                      className={`pill-option ${selectedDifficulty === 'all' ? 'active' : ''}`}
                    >
                      All
                    </button>
                    {[
                      { value: '0', label: 'Tier 0 (Basic)' },
                      { value: '1', label: 'Tier 1 (Easy)' },
                      { value: '2', label: 'Tier 2 (Medium)' },
                      { value: '3', label: 'Tier 3 (Hard)' },
                      { value: '4', label: 'Tier 4 (Expert)' },
                    ].map((diff) => (
                      <button
                        key={diff.value}
                        type="button"
                        onClick={() => {
                          setSelectedDifficulty(diff.value);
                          setPage(1);
                        }}
                        className={`pill-option ${selectedDifficulty === diff.value ? 'active' : ''}`}
                      >
                        {diff.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Exam Year (PYQ) Filter */}
                <div className="filter-group">
                  <label className="filter-group-label">
                    <span>Exam Year (PYQ)</span>
                    {yearsList.length > 0 && (
                      <span className="filter-count-tag">{yearsList.length} Years</span>
                    )}
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => {
                      setSelectedYear(e.target.value);
                      setPage(1);
                    }}
                    className="portal-select"
                  >
                    <option value="all">All Exam Years</option>
                    {yearsList.map((yr) => (
                      <option key={yr} value={String(yr)}>Year {yr}</option>
                    ))}
                  </select>
                </div>

                {/* 5. Chapter / Topic Filter */}
                <div className="filter-group">
                  <label className="filter-group-label">
                    <span>Chapter / Topic</span>
                    {topicsList.length > 0 && (
                      <span className="filter-count-tag">{topicsList.length} Chapters</span>
                    )}
                  </label>
                  <select
                    value={selectedTopic}
                    onChange={(e) => {
                      setSelectedTopic(e.target.value);
                      setSelectedSubTopic('all');
                      setPage(1);
                    }}
                    className="portal-select"
                  >
                    <option value="all">
                      {topicsList.length ? `All Chapters (${topicsList.length})` : 'All Chapters'}
                    </option>
                    {topicsList.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* 6. Sub-Topic / Concept Filter */}
                <div className="filter-group">
                  <label className="filter-group-label">
                    <span>Sub-Topic / Concept</span>
                    {subTopicsList.length > 0 && (
                      <span className="filter-count-tag">{subTopicsList.length}</span>
                    )}
                  </label>
                  <select
                    value={selectedSubTopic}
                    onChange={(e) => {
                      setSelectedSubTopic(e.target.value);
                      setPage(1);
                    }}
                    disabled={subTopicsList.length === 0}
                    className="portal-select"
                  >
                    <option value="all">All Sub-Topics</option>
                    {subTopicsList.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                {/* 7. Language Filter */}
                <div className="filter-group">
                  <label className="filter-group-label">Language</label>
                  <div className="segmented-control">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLang('all');
                        setPage(1);
                      }}
                      className={`segment-btn ${selectedLang === 'all' ? 'active' : ''}`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLang('en');
                        setPage(1);
                      }}
                      className={`segment-btn ${selectedLang === 'en' ? 'active' : ''}`}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLang('hi');
                        setPage(1);
                      }}
                      className={`segment-btn ${selectedLang === 'hi' ? 'active' : ''}`}
                    >
                      Hindi
                    </button>
                  </div>
                </div>

                {/* 8. Diagram Filter Toggle */}
                <div className="filter-toggle-row">
                  <div className="toggle-info">
                    <ImageIcon size={15} className="text-navy" />
                    <span className="toggle-label">Diagrams Only</span>
                  </div>
                  <input
                    type="checkbox"
                    id="has-diagram-toggle"
                    checked={hasImageOnly}
                    onChange={(e) => {
                      setHasImageOnly(e.target.checked);
                      setPage(1);
                    }}
                    className="portal-toggle"
                  />
                </div>
                    {/* Sticky Mobile Apply Button */}
                    <div className="mobile-filter-apply-bar">
                      <button
                        type="button"
                        onClick={() => setMobileFiltersOpen(false)}
                        className="btn-apply-filters"
                      >
                        Show {totalQuestions.toLocaleString()} Questions
                      </button>
                    </div>
                  </>
                )}
              </div>
            </aside>

            {/* Mobile Sidebar Backdrop */}
            {mobileFiltersOpen && (
              <div
                className="mobile-backdrop"
                onClick={() => setMobileFiltersOpen(false)}
              />
            )}

            {/* Right Main Content: Feed Panel */}
            <main className="portal-main">
              {/* Active Filter Chips & Bar */}
              <div className="feed-toolbar">
                <div className="active-chips-row">
                  <span className="chips-title">Active:</span>
                  {selectedClass !== 'all' && (
                    <span className="filter-chip">
                      <span>Class: {selectedClass}</span>
                      <button onClick={() => setSelectedClass('all')}><X size={11} /></button>
                    </span>
                  )}
                  {selectedSubject !== 'all' && (
                    <span className="filter-chip">
                      <span>Subject: {selectedSubject}</span>
                      <button onClick={() => setSelectedSubject('all')}><X size={11} /></button>
                    </span>
                  )}
                  {selectedDifficulty !== 'all' && (
                    <span className="filter-chip">
                      <span>Tier: {selectedDifficulty}</span>
                      <button onClick={() => setSelectedDifficulty('all')}><X size={11} /></button>
                    </span>
                  )}
                  {selectedYear !== 'all' && (
                    <span className="filter-chip">
                      <span>Year: {selectedYear}</span>
                      <button onClick={() => setSelectedYear('all')}><X size={11} /></button>
                    </span>
                  )}
                  {selectedTopic !== 'all' && (
                    <span className="filter-chip">
                      <span>Topic: {selectedTopic}</span>
                      <button onClick={() => setSelectedTopic('all')}><X size={11} /></button>
                    </span>
                  )}
                  {selectedLang !== 'all' && (
                    <span className="filter-chip">
                      <span>Lang: {selectedLang.toUpperCase()}</span>
                      <button onClick={() => setSelectedLang('all')}><X size={11} /></button>
                    </span>
                  )}
                  {hasImageOnly && (
                    <span className="filter-chip">
                      <span>Diagrams Only</span>
                      <button onClick={() => setHasImageOnly(false)}><X size={11} /></button>
                    </span>
                  )}
                  {searchQuery && (
                    <span className="filter-chip search-chip">
                      <span>Search: &ldquo;{searchQuery}&rdquo;</span>
                      <button onClick={() => { setSearchQuery(''); setSearchInput(''); }}><X size={11} /></button>
                    </span>
                  )}
                  {activeFiltersCount === 0 && (
                    <span className="text-muted text-sm">All questions in repository</span>
                  )}
                </div>

                {/* Results count & Page navigator */}
                <div className="toolbar-right">
                  <div className="results-count-badge">
                    <span>Showing </span>
                    <b>{questions.length > 0 ? (page - 1) * limit + 1 : 0}</b>
                    <span>–</span>
                    <b>{Math.min(page * limit, totalQuestions)}</b>
                    <span> of </span>
                    <b className="text-navy">{totalQuestions.toLocaleString()}</b>
                  </div>

                  <div className="per-page-select-wrapper">
                    <select
                      value={limit}
                      onChange={(e) => {
                        setLimit(Number(e.target.value));
                        setPage(1);
                      }}
                      className="per-page-select"
                    >
                      <option value={15}>15 / page</option>
                      <option value={30}>30 / page</option>
                      <option value={50}>50 / page</option>
                    </select>
                  </div>

                  <div className="toolbar-page-nav">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1 || loading}
                      className="btn-toolbar-nav"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <span className="toolbar-page-indicator">{page} / {totalPages || 1}</span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages || loading}
                      className="btn-toolbar-nav"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="alert-box alert-error">
                  <XCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* Question Feed */}
              {loading ? (
                <div className="questions-feed">
                  {[1, 2, 3, 4].map((n) => (
                    <QuestionCardSkeleton key={n} />
                  ))}
                </div>
              ) : questions.length === 0 ? (
                <div className="empty-state-card">
                  <HelpCircle size={44} className="text-muted" />
                  <h3>No questions found matching your criteria</h3>
                  <p>Try clearing your chapter, keyword, or year filters to broaden results.</p>
                  <button onClick={handleResetFilters} className="btn-primary">
                    <RotateCcw size={15} />
                    <span>Reset All Filters</span>
                  </button>
                </div>
              ) : (
                <div className="questions-feed">
                  {questions.map((q, idx) => (
                    <QuestionCard
                      key={q._id || q.id}
                      question={q}
                      index={(page - 1) * limit + idx + 1}
                      onImageZoom={(url, title) => setZoomImage({ url, title })}
                      onInspectTags={(questionData) => setInspectedQuestion(questionData)}
                      onEditTags={(questionData) => setEditingQuestion(questionData)}
                    />
                  ))}
                </div>
              )}

              {/* Bottom Pagination */}
              {totalPages > 1 && (
                <div className="pagination-bottom">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page <= 1 || loading}
                    className="btn-page-text"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || loading}
                    className="btn-page-text"
                  >
                    <ChevronLeft size={15} />
                    <span>Previous</span>
                  </button>

                  <span className="page-bottom-info">
                    Page <b>{page}</b> of <b>{totalPages}</b>
                  </span>

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading}
                    className="btn-page-text"
                  >
                    <span>Next</span>
                    <ChevronRight size={15} />
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page >= totalPages || loading}
                    className="btn-page-text"
                  >
                    Last ({totalPages})
                  </button>
                </div>
              )}
            </main>
          </div>


        </>
      )}

      {/* PAPER GENERATOR TAB */}
      {activeNavTab === 'generator' && (
        <PaperGeneratorView
          classesList={classesList}
          subjectsList={subjectsList}
          topicsList={topicsList}
          onImageZoom={(url, title) => setZoomImage({ url, title })}
          showToast={showToast}
          onNavigateToBank={() => navigate('bank')}
          paperId={paperId}
        />
      )}

      {/* SAVED PAPERS TAB */}
      {activeNavTab === 'saved' && (
        <SavedPapersView
          onLoadPaper={handleLoadSavedPaper}
          onNavigateToGenerator={() => navigate('generator')}
          showToast={showToast}
        />
      )}

      {activeNavTab === 'exams' && <ExamManagementView onBack={() => navigate('dashboard')} showToast={showToast} />}

        </section>
      </div>

      {/* High-Resolution Diagram Zoom Modal */}
      <ImageModal
        url={zoomImage?.url || null}
        title={zoomImage?.title}
        onClose={() => setZoomImage(null)}
      />

      {/* 35-Field Taxonomy Inspector Modal (Read-Only JSON) */}
      <TaggingInspectorModal
        question={inspectedQuestion}
        onClose={() => setInspectedQuestion(null)}
      />

      {/* Interactive Tagging & Metadata Editor Modal */}
      <EditTaggingModal
        question={editingQuestion}
        onClose={() => setEditingQuestion(null)}
        onSaved={handleQuestionSaved}
        availableClasses={classesList}
        availableSubjects={subjectsList}
      />
    </div>
  );
}
