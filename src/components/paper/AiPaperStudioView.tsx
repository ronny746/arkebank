'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, LoaderCircle, Printer, RefreshCw, Save, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { PaperMetadata, QuestionItem } from '@/types/paper';
import PaperPrintableDocument from './PaperPrintableDocument';
import type { TenantBrand } from '@/lib/tenant';

type QuestionFormat = 'mcq' | 'subjective' | 'numerical' | 'true_false';
type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed';

interface AiPaperStudioViewProps {
  classesList: string[];
  subjectsList: string[];
  showToast: (message: string) => void;
  tenant: TenantBrand;
}

const DEFAULT_SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Science', 'English', 'Reasoning'];
const DEFAULT_CLASSES = ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12', 'JEE Main', 'JEE Advanced', 'NEET'];
const SCHOOL_CLASS_OPTIONS = ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];
const EXAM_SUBJECTS: Record<string, string[]> = {
  'JEE Main': ['Physics', 'Chemistry', 'Mathematics'],
  'JEE Advanced': ['Physics', 'Chemistry', 'Mathematics'],
  NEET: ['Physics', 'Chemistry', 'Biology'],
};

const splitTerms = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);

export default function AiPaperStudioView({ classesList, subjectsList, showToast, tenant }: AiPaperStudioViewProps) {
  const classOptions = useMemo(() => Array.from(new Set([...DEFAULT_CLASSES, ...classesList])), [classesList]);
  const subjectOptions = useMemo(() => Array.from(new Set([...DEFAULT_SUBJECTS, ...subjectsList])), [subjectsList]);
  const schoolClassOptions = useMemo(() => {
    const suppliedClasses = classOptions.filter((item) => /^Class\s+(9|10|11|12)$/i.test(item));
    return Array.from(new Set([...SCHOOL_CLASS_OPTIONS, ...suppliedClasses]));
  }, [classOptions]);
  const [classStd, setClassStd] = useState('Class 12');
  const [targetExam, setTargetExam] = useState('School assessment');
  const [subjects, setSubjects] = useState<string[]>(['Physics']);
  const [subjectsMenuOpen, setSubjectsMenuOpen] = useState(false);
  const subjectsMenuRef = useRef<HTMLDivElement>(null);
  const [topicText, setTopicText] = useState('');
  const [subTopicText, setSubTopicText] = useState('');
  const [format, setFormat] = useState<QuestionFormat>('mcq');
  const [difficulty, setDifficulty] = useState<Difficulty>('mixed');
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [includeDiagrams, setIncludeDiagrams] = useState(false);
  const [count, setCount] = useState(10);
  const [marks, setMarks] = useState(4);
  const [negativeMarks, setNegativeMarks] = useState(1);
  const [title, setTitle] = useState('AI Practice Assessment');
  const [instituteName, setInstituteName] = useState(tenant.paperInstituteName);
  const [instituteLogoUrl, setInstituteLogoUrl] = useState('');
  const [watermarkText, setWatermarkText] = useState(tenant.portalName);
  const [showWatermark, setShowWatermark] = useState(true);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'review' | 'preview'>('review');

  const validSubjectOptions = useMemo(() => EXAM_SUBJECTS[targetExam] || subjectOptions, [subjectOptions, targetExam]);

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (subjectsMenuRef.current && !subjectsMenuRef.current.contains(event.target as Node)) setSubjectsMenuOpen(false);
    };
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, []);

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

  const selectTargetExam = (nextTarget: string) => {
    setTargetExam(nextTarget);
    if (EXAM_SUBJECTS[nextTarget]) {
      setSubjects(EXAM_SUBJECTS[nextTarget]);
      setClassStd('Class 12');
    } else {
      setSubjects((current) => {
        const retained = current.filter((subject) => subjectOptions.includes(subject)).slice(0, 1);
        return retained.length ? retained : [subjectOptions[0] || 'Physics'];
      });
    }
  };

  const toggleSubject = (subject: string) => {
    if (EXAM_SUBJECTS[targetExam]) return;
    setSubjects((current) => current.includes(subject)
      ? (current.length === 1 ? current : current.filter((item) => item !== subject))
      : [...current, subject]);
  };

  const generate = async (replaceIndex?: number) => {
    setGenerating(true);
    try {
      const token = localStorage.getItem('arke_token');
      const response = await fetch('/api/ai/paper/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          classStd,
          targetExam,
          subjects,
          topics: splitTerms(topicText),
          subTopics: splitTerms(subTopicText),
          questionType: format,
          difficulty,
          language,
          includeDiagrams,
          count: replaceIndex === undefined ? count : 1,
          marks,
          negativeMarks,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'AI could not generate questions.');
      const generated = data.questions as QuestionItem[];
      if (replaceIndex === undefined) {
        setQuestions(generated);
        setView('review');
        showToast(`${generated.length} original AI questions are ready for review.`);
      } else if (generated[0]) {
        setQuestions((current) => current.map((question, index) => index === replaceIndex ? generated[0] : question));
        showToast(`Question ${replaceIndex + 1} regenerated with AI.`);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'AI generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const updateQuestion = (index: number, question: string) => {
    setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, question } : item));
  };

  const savePaper = async () => {
    if (!questions.length) return showToast('Generate at least one AI question before saving.');
    setSaving(true);
    try {
      const token = localStorage.getItem('arke_token');
      const response = await fetch('/api/paper/save', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          id: `ai_paper_${Date.now()}`,
          title,
          instituteName,
          class_std: classStd,
          subject: targetExam || subjects.join(' + '),
          timeAllowed: `${Math.max(10, count * 2)} Mins`,
          totalMarks: questions.reduce((total, question) => total + (Number(question.marks) || marks), 0),
          totalQuestions: questions.length,
          questions,
          instructions: ['All questions are compulsory.', `Each question carries ${marks} marks.`, 'This paper was generated with AI and reviewed by faculty.'],
          source: 'ai',
          aiProvider: 'anthropic',
          createdAt: new Date().toISOString(),
          brandName: tenant.portalName,
          brandLogoSrc: instituteLogoUrl || tenant.logoSrc,
          brandLogoWidth: tenant.logoWidth,
          brandLogoHeight: tenant.logoHeight,
          watermarkText: watermarkText || tenant.portalName,
          showWatermark,
          footerText: tenant.paperFooterText,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not save the AI paper.');
      showToast('AI paper saved to the database.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save the AI paper.');
    } finally {
      setSaving(false);
    }
  };

  const metadata: PaperMetadata = {
    title,
    instituteName,
    class_std: classStd,
    subject: targetExam || subjects.join(' + '),
    subjectLabel: targetExam ? 'Target Exam:' : 'Subject:',
    timeAllowed: `${Math.max(10, questions.length * 2)} Mins`,
    totalMarks: questions.reduce((total, question) => total + (Number(question.marks) || marks), 0),
    instructions: ['All questions are compulsory.', `Each question carries ${marks} marks.`, 'AI-generated content has been reviewed by faculty.'],
    watermarkText: watermarkText || tenant.portalName,
    showWatermark,
    brandName: tenant.portalName,
    brandLogoSrc: instituteLogoUrl || tenant.logoSrc,
    brandLogoWidth: tenant.logoWidth,
    brandLogoHeight: tenant.logoHeight,
    footerText: tenant.paperFooterText,
  };

  return (
    <section className="ai-paper-studio" aria-labelledby="ai-paper-studio-title">
      <header className="ai-studio-hero">
        <div>
          <span className="ai-studio-eyebrow"><Sparkles size={14} /> ANTHROPIC · CLAUDE</span>
          <h1 id="ai-paper-studio-title">AI Paper Studio</h1>
          <p>Build a fresh assessment from your brief. No question-bank records are used for generation.</p>
        </div>
        <div className="ai-origin-note"><ShieldCheck size={18} /><span><b>AI-only source</b>Generated questions are labelled and saved separately for faculty review.</span></div>
      </header>

      <div className="ai-studio-layout">
        <form className="ai-blueprint-card" onSubmit={(event) => { event.preventDefault(); void generate(); }} noValidate>
          <div className="ai-card-heading"><span>01</span><div><h2>AI assessment brief</h2><p>Give Claude the teaching context, not database filters.</p></div></div>
          <div className="ai-form-grid">
            <label>Class / level<select value={classStd} onChange={(event) => setClassStd(event.target.value)}>{schoolClassOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Target exam / board<select value={targetExam} onChange={(event) => selectTargetExam(event.target.value)}><option>School assessment</option><option>CBSE</option><option>ICSE / ISC</option><option>State board</option><option>JEE Main</option><option>JEE Advanced</option><option>NEET</option></select></label>
            <div className="ai-full-field ai-subject-picker" ref={subjectsMenuRef}><span className="ai-field-label">Subjects <small>{EXAM_SUBJECTS[targetExam] ? `${targetExam} requires this subject combination` : 'Select one or more subjects'}</small></span><button type="button" className="ai-subject-picker-trigger" aria-expanded={subjectsMenuOpen} aria-haspopup="listbox" onClick={() => !EXAM_SUBJECTS[targetExam] && setSubjectsMenuOpen((current) => !current)} disabled={Boolean(EXAM_SUBJECTS[targetExam])}><span>{subjects.map((subject) => <i key={subject}>{subject}</i>)}</span><ChevronDown size={17} /></button>{subjectsMenuOpen && <div className="ai-subject-picker-menu" role="listbox" aria-multiselectable="true">{validSubjectOptions.map((subject) => <button type="button" role="option" aria-selected={subjects.includes(subject)} key={subject} className={subjects.includes(subject) ? 'selected' : ''} onClick={() => toggleSubject(subject)}><CheckCircle2 size={15} />{subject}</button>)}</div>}<output className="ai-selected-summary" aria-live="polite">{subjects.length} subject{subjects.length === 1 ? '' : 's'} selected</output></div>
            <label className="ai-full-field">Topics <small>Optional — add multiple with commas</small><input list="ai-topic-suggestions" value={topicText} onChange={(event) => setTopicText(event.target.value)} placeholder="e.g. Thermodynamics, Current electricity" /><datalist id="ai-topic-suggestions"><option value="Thermodynamics" /><option value="Current Electricity" /><option value="Chemical bonding" /><option value="Human physiology" /></datalist></label>
            <label className="ai-full-field">Sub-topics <small>Optional — add multiple with commas</small><input list="ai-subtopic-suggestions" value={subTopicText} onChange={(event) => setSubTopicText(event.target.value)} placeholder="e.g. Laws of thermodynamics, AC circuits" /><datalist id="ai-subtopic-suggestions"><option value="Laws of thermodynamics" /><option value="AC circuits" /><option value="Numericals" /><option value="Diagram-based questions" /></datalist></label>
            <label>Question format<select value={format} onChange={(event) => setFormat(event.target.value as QuestionFormat)}><option value="mcq">MCQ</option><option value="subjective">Subjective / Theory</option><option value="numerical">Numerical</option><option value="true_false">True / False</option></select></label>
            <label>Difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)}><option value="mixed">Balanced mix</option><option value="easy">Easy (Tier 0–1)</option><option value="medium">Moderate (Tier 2)</option><option value="hard">Tough (Tier 3–4)</option></select></label>
            <label>Language<select value={language} onChange={(event) => setLanguage(event.target.value as 'en' | 'hi')}><option value="en">English</option><option value="hi">Hindi</option></select></label>
            <label>Teaching diagrams<select value={includeDiagrams ? 'yes' : 'no'} onChange={(event) => { const enabled = event.target.value === 'yes'; setIncludeDiagrams(enabled); if (enabled) setCount((current) => Math.min(current, 5)); }}><option value="no">Text only</option><option value="yes">Include SVG diagrams (max 5)</option></select></label>
            <label>Questions <small>{includeDiagrams ? 'Diagram batches are limited to 5 for reliable generation' : 'Up to 25 per batch'}</small><input type="number" min="1" max={includeDiagrams ? 5 : 25} value={count} onChange={(event) => setCount(Math.max(1, Math.min(includeDiagrams ? 5 : 25, Number(event.target.value) || 1)))} /></label>
            <label>Marks / question<input type="number" min="1" max="20" value={marks} onChange={(event) => setMarks(Math.max(1, Number(event.target.value) || 1))} /></label>
            <label>Negative marks<input type="number" min="0" max="10" step="0.25" value={negativeMarks} onChange={(event) => setNegativeMarks(Math.max(0, Number(event.target.value) || 0))} /></label>
            <label className="ai-full-field">Paper title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label className="ai-full-field ai-watermark-choice"><input type="checkbox" checked={showWatermark} onChange={(event) => setShowWatermark(event.target.checked)} /> Include watermark on this paper {showWatermark && <input value={watermarkText} onChange={(event) => setWatermarkText(event.target.value)} aria-label="Watermark text" placeholder={tenant.portalName} />}</label>
          </div>
          <button className="ai-generate-button" type="submit" disabled={generating || !subjects.length}><Sparkles size={17} />{generating ? 'Claude is drafting questions…' : `Generate ${count} original questions`}</button>
          <p className="ai-form-footnote">{includeDiagrams ? 'Each diagram is self-contained. Check labels and accuracy before publishing.' : 'AI output must be reviewed by faculty before publishing to students.'}</p>
        </form>

        <aside className="ai-generation-guide">
          <span>HOW IT WORKS</span>
          <ol><li><b>Set the brief</b><p>Select subjects, topics and assessment rules.</p></li><li><b>Claude drafts</b><p>The server requests new structured questions; the question bank is not queried.</p></li><li><b>Review & save</b><p>Edit, regenerate or remove questions, then save the approved paper.</p></li></ol>
          <div><ShieldCheck size={17} /><p>The Anthropic API key stays on the server in <code>ANTHROPIC_API_KEY</code>.</p></div>
        </aside>
      </div>

      {generating && <section className="ai-generation-progress" role="status" aria-live="polite" aria-label="Claude is generating questions">
        <div className="ai-progress-icon"><LoaderCircle size={22} /></div>
        <div><b>Creating your {count}-question paper</b><p>Claude is drafting structured questions. Keep this page open; the review panel will update automatically.</p></div>
        <div className="ai-progress-skeletons" aria-hidden="true"><i /><i /><i /></div>
      </section>}

      {questions.length > 0 && <section className="ai-review-panel">
        <div className="ai-review-header"><div><span>02 · REVIEW GENERATED QUESTIONS</span><h2>{questions.length} AI questions ready</h2></div><div className="ai-review-actions"><button type="button" className={view === 'review' ? 'active' : ''} onClick={() => setView('review')}>Review</button><button type="button" className={view === 'preview' ? 'active' : ''} onClick={() => setView('preview')}>Student paper</button><button type="button" onClick={savePaper} disabled={saving}><Save size={15} />{saving ? 'Saving…' : 'Save to database'}</button>{view === 'preview' && <button type="button" onClick={() => window.print()}><Printer size={15} />Print</button>}</div></div>
        {view === 'review' ? <div className="ai-question-list">{questions.map((question, index) => <article className="ai-question-card" key={question._id}><header><span>Q.{index + 1}</span><div><b>AI generated</b><small>{question.subject} · {question.topic || 'General'} · {String(question.difficulty || 'medium')}{question.question_image ? ' · Diagram included' : ''}</small></div><button type="button" onClick={() => void generate(index)} disabled={generating} title="Regenerate this question"><RefreshCw size={15} /></button><button type="button" onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))} title="Remove question"><Trash2 size={15} /></button></header><textarea className="resize-none" value={question.question} onChange={(event) => updateQuestion(index, event.target.value)} aria-label={`Question ${index + 1} text`} />{question.question_image && <figure className="ai-question-diagram"><img src={question.question_image} alt={`Diagram for question ${index + 1}`} /><figcaption>AI-generated teaching diagram — check labels and accuracy before publishing.</figcaption></figure>}{question.options?.length ? <div className="ai-options-grid">{question.options.map((option) => <span key={option.key}><b>{option.key.toUpperCase()}.</b> {option.text}</span>)}</div> : null}<details><summary>Answer & faculty solution</summary><p><b>Correct answer:</b> {question.correct_option?.toUpperCase() || 'Model answer'}</p><p>{question.solution || 'No solution returned.'}</p></details></article>)}</div> : <div className="ai-print-preview"><PaperPrintableDocument metadata={metadata} questions={questions} mode="paper" /></div>}
      </section>}
    </section>
  );
}
