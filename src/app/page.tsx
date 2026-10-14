'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Calendar
} from 'lucide-react';
import LoginForm from '@/components/LoginForm';
import QuestionCard from '@/components/QuestionCard';
import ImageModal from '@/components/ImageModal';
import TaggingInspectorModal from '@/components/TaggingInspectorModal';
import EditTaggingModal from '@/components/EditTaggingModal';
import QuestionCardSkeleton from '@/components/QuestionCardSkeleton';
import SidebarFiltersSkeleton from '@/components/SidebarFiltersSkeleton';

export default function Home() {
  // Authentication State
  const [user, setUser] = useState<{ email: string } | null>(null);
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

      const res = await fetch(`/api/filters?${params.toString()}`);
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

      const res = await fetch(`/api/questions?${params.toString()}`);
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

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="header-search-form">
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
        </form>

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

      {/* Main Dashboard Two-Column Layout */}
      <div className="portal-dashboard">
        {/* Left Sidebar: ALL Filters Cleanly Organized */}
        <aside className="portal-sidebar">
          <div className="sidebar-header">
            <div className="sidebar-title-row">
              <Filter size={15} className="text-emerald" />
              <span className="sidebar-title">All Filters & Taxonomy</span>
            </div>
            {activeFiltersCount > 0 && (
              <button onClick={handleResetFilters} className="btn-sidebar-reset">
                <RotateCcw size={11} />
                <span>Reset ({activeFiltersCount})</span>
              </button>
            )}
          </div>

          <div className="sidebar-content">
            {filtersLoading ? (
              <SidebarFiltersSkeleton />
            ) : (
              <>
            {/* 1. Target Class / Stream */}
            <div className="filter-group">
              <label className="filter-group-label">Class / Examination Target</label>
              <div className="pill-grid">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClass('all');
                    setSelectedTopic('all');
                    setSelectedSubTopic('all');
                    setPage(1);
                  }}
                  className={`pill-option ${selectedClass === 'all' ? 'active' : ''}`}
                >
                  All
                </button>
                {classesList.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setSelectedClass(c);
                      setSelectedTopic('all');
                      setSelectedSubTopic('all');
                      setPage(1);
                    }}
                    className={`pill-option ${selectedClass === c ? 'active' : ''}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Subject Filter */}
            <div className="filter-group">
              <label className="filter-group-label">Subject</label>
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
                {subjectsList.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSelectedSubject(s);
                      setSelectedTopic('all');
                      setSelectedSubTopic('all');
                      setPage(1);
                    }}
                    className={`pill-option ${selectedSubject === s ? 'active' : ''}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Difficulty Level Filter */}
            <div className="filter-group">
              <label className="filter-group-label">Difficulty Level</label>
              <div className="pill-grid">
                {difficultiesList.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => {
                      setSelectedDifficulty(d.value);
                      setPage(1);
                    }}
                    className={`pill-option pill-diff diff-${d.value} ${selectedDifficulty === d.value ? 'active' : ''}`}
                  >
                    {d.value === 'all' ? 'All' : `Tier ${d.value} (${d.label.split('-')[1]?.trim() || d.label})`}
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
                <option value="all">
                  {subTopicsList.length ? `All Concepts (${subTopicsList.length})` : 'Select a Chapter first'}
                </option>
                {subTopicsList.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            {/* 7. Language Filter */}
            <div className="filter-group">
              <label className="filter-group-label">Language</label>
              <div className="segmented-switch">
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
              </>
            )}
          </div>
        </aside>

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
