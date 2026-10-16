'use client';

import { useEffect, useState } from 'react';
import { Activity, ArrowLeft, BarChart3, CheckCircle2, Clock3, Copy, Download, Radio, RefreshCw, ShieldAlert, Users, ExternalLink, Globe, Trash2 } from 'lucide-react';
import { getPublicExamUrl } from '@/lib/public-url';
import type { OnlineExam } from '@/types/exam';

type ManagedExam = OnlineExam & { attemptCount: number; liveCount: number; submittedCount: number; questionCount: number };
type Attempt = {
  id: string;
  student: { name: string; email: string };
  status: string;
  startedAt: string;
  updatedAt?: string;
  submittedAt?: string;
  currentQuestion?: number;
  answers?: Record<string, string>;
  violations?: { tabSwitches?: number; fullScreenExits?: number };
  result?: { score?: number; totalCorrect?: number; totalWrong?: number; totalUnattempted?: number };
};
type Detail = { summary: { total: number; live: number; submitted: number; averageScore: number; violations: number }; attempts: Attempt[] };
type View = 'live' | 'results';

const statusLabel = (status: string) => status.replaceAll('_', ' ');
const timestamp = (value?: string) => value ? new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
const downloadResults = (title: string, attempts: Attempt[]) => {
  const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const rows: Array<Array<string | number>> = [['Student', 'Email', 'Status', 'Score', 'Correct', 'Wrong', 'Unattempted', 'Tab switches', 'Fullscreen exits', 'Submitted at']];
  attempts.forEach(attempt => rows.push([attempt.student.name, attempt.student.email, statusLabel(attempt.status), attempt.result?.score ?? '', attempt.result?.totalCorrect ?? '', attempt.result?.totalWrong ?? '', attempt.result?.totalUnattempted ?? '', attempt.violations?.tabSwitches ?? 0, attempt.violations?.fullScreenExits ?? 0, attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString('en-IN') : '']));
  const file = new Blob([rows.map(row => row.map(quote).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(file); const link = document.createElement('a');
  link.href = url; link.download = `${title.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '') || 'exam'}-results.csv`;
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
};

export default function ExamManagementView({ onBack, showToast }: { onBack: () => void; showToast: (message: string) => void }) {
  const [exams, setExams] = useState<ManagedExam[]>([]);
  const [active, setActive] = useState<ManagedExam | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('live');
  const headers = (): Record<string, string> => { const token = localStorage.getItem('arke_token'); return token ? { Authorization: `Bearer ${token}` } : {}; };
  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/exams', { headers: headers(), credentials: 'include' }); const data = await response.json();
      if (!response.ok) throw new Error(data.error); setExams(data.exams);
      if (active) setActive(data.exams.find((exam: ManagedExam) => exam.id === active.id) || null);
    } catch (reason) { showToast(reason instanceof Error ? reason.message : 'Could not load exams.'); } finally { setLoading(false); }
  };
  const loadDetail = async (exam: ManagedExam, preserveView = true) => {
    try {
      const response = await fetch(`/api/exams/${exam.id}/analysis`, { headers: headers(), credentials: 'include' }); const data = await response.json();
      if (!response.ok) throw new Error(data.error); setDetail({ summary: data.summary, attempts: data.attempts });
      if (!preserveView) setView('live');
    } catch (reason) { showToast(reason instanceof Error ? reason.message : 'Could not load exam activity.'); }
  };
  const open = async (exam: ManagedExam) => { setActive(exam); setDetail(null); await loadDetail(exam, false); };
  useEffect(() => { const initialLoad = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(initialLoad); // Load once on workspace entry.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!active) return;
    const refresh = window.setInterval(() => { void loadDetail(active); }, 10_000);
    return () => window.clearInterval(refresh);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);
  const deleteExam = async (examId: string, examTitle?: string) => {
    if (!confirm(`Are you sure you want to delete "${examTitle || 'this exam'}"? All candidate responses will also be removed.`)) return;

    try {
      const res = await fetch(`/api/exams/${examId}`, {
        method: 'DELETE',
        headers: headers(),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete exam');
      }

      setExams(prev => prev.filter(e => e.id !== examId && e.slug !== examId));
      if (active && (active.id === examId || active.slug === examId)) {
        setActive(null);
        setDetail(null);
      }
      showToast('Exam deleted successfully.');
    } catch (err: any) {
      showToast(err.message || 'Could not delete exam.');
    }
  };

  const copy = async (slug: string) => {
    const liveUrl = getPublicExamUrl(slug);
    await navigator.clipboard.writeText(liveUrl);
    showToast('Student exam link copied.');
  };

  if (active) {
    const completed = detail?.attempts.filter(attempt => attempt.status === 'submitted' || attempt.status === 'auto_submitted') || [];
    return <main className="exam-console">
      <button className="workspace-back" onClick={() => { setActive(null); setDetail(null); }}><ArrowLeft size={16}/> All exams</button>
      <div className="exam-console-heading">
        <div><span className="dashboard-eyebrow">LIVE EXAM CONTROL</span><h1>{active.title}</h1><p>{active.paper.class_std} · {active.paper.subject} · {active.questionCount} questions · refreshes every 10 seconds</p></div>
        <div className="console-head-actions"><button className="workspace-back" onClick={() => void loadDetail(active)}><RefreshCw size={15}/> Refresh now</button><button className="exam-copy-link" onClick={() => void copy(active.slug)}><Copy size={15}/> Copy student link</button><a className="exam-open-link" href={getPublicExamUrl(active.slug)} target="_blank" rel="noreferrer" title="Open live student test page"><ExternalLink size={15}/> Open live test</a><button className="exam-delete-btn" onClick={() => void deleteExam(active.id, active.title)} title="Delete exam"><Trash2 size={15}/> Delete exam</button></div>
      </div>
      {!detail ? <p className="console-loading">Loading exam control room…</p> : <>
        <section className="exam-live-stats">
          <div><Radio/><b>{detail.summary.live}</b><span>Live now</span></div><div><Users/><b>{detail.summary.total}</b><span>Registered</span></div><div><CheckCircle2/><b>{detail.summary.submitted}</b><span>Submitted</span></div><div><BarChart3/><b>{detail.summary.averageScore}</b><span>Average score</span></div><div><ShieldAlert/><b>{detail.summary.violations}</b><span>Security events</span></div>
        </section>
        <div className="exam-view-tabs" role="tablist" aria-label="Exam monitoring views"><button role="tab" aria-selected={view === 'live'} className={view === 'live' ? 'active' : ''} onClick={() => setView('live')}><Activity size={16}/> Live activity</button><button role="tab" aria-selected={view === 'results'} className={view === 'results' ? 'active' : ''} onClick={() => setView('results')}><BarChart3 size={16}/> Results ({completed.length})</button></div>
        {view === 'live' ? <section className="exam-activity-panel"><header><div><h2><Activity size={18}/> Candidate activity</h2><p>Answers, active question and security events update automatically every 10 seconds.</p></div><button onClick={() => void loadDetail(active)}><RefreshCw size={15}/> Refresh</button></header>{detail.attempts.length === 0 ? <div className="exam-empty">No student has opened this exam yet. Share the student link to begin.</div> : <div className="candidate-table">{detail.attempts.map(attempt => { const events = (attempt.violations?.tabSwitches || 0) + (attempt.violations?.fullScreenExits || 0); const answered = Object.keys(attempt.answers || {}).length; return <div key={attempt.id} className="candidate-row"><div className="candidate-avatar">{attempt.student.name.slice(0, 1).toUpperCase()}</div><div><b>{attempt.student.name}</b><small>{attempt.student.email}</small></div><span className={`candidate-status ${attempt.status}`}>{statusLabel(attempt.status)}</span><span>{answered}/{active.questionCount} answered <small>Question {(attempt.currentQuestion || 0) + 1}</small></span><span>{attempt.status === 'in_progress' ? `Seen ${timestamp(attempt.updatedAt || attempt.startedAt)}` : `Score ${attempt.result?.score ?? '—'}`}</span><span className={events ? 'event-alert' : ''}>{events ? `${events} alert${events > 1 ? 's' : ''}` : 'Clear'}</span></div>; })}</div>}</section> : <section className="exam-results-panel"><header><div><h2>Submission results</h2><p>Final score and response breakdown for submitted candidates.</p></div><button className="workspace-back" disabled={!completed.length} onClick={() => downloadResults(active.title, completed)}><Download size={15}/> Export CSV</button></header>{completed.length === 0 ? <div className="exam-empty">Results will appear here after students submit the examination.</div> : <div className="exam-results-scroll"><table><thead><tr><th>Student</th><th>Status</th><th>Score</th><th>Correct</th><th>Wrong</th><th>Unattempted</th><th>Security</th><th>Submitted</th></tr></thead><tbody>{completed.map(attempt => { const events = (attempt.violations?.tabSwitches || 0) + (attempt.violations?.fullScreenExits || 0); return <tr key={attempt.id}><td><b>{attempt.student.name}</b><small>{attempt.student.email}</small></td><td><span className={`candidate-status ${attempt.status}`}>{statusLabel(attempt.status)}</span></td><td><b>{attempt.result?.score ?? '—'}</b></td><td>{attempt.result?.totalCorrect ?? '—'}</td><td>{attempt.result?.totalWrong ?? '—'}</td><td>{attempt.result?.totalUnattempted ?? '—'}</td><td className={events ? 'event-alert' : ''}>{events ? `${events} alerts` : 'Clear'}</td><td>{timestamp(attempt.submittedAt)}</td></tr>; })}</tbody></table></div>}</section>}
      </>}
    </main>;
  }

  return <main className="exam-console"><div className="exam-console-heading"><div><span className="dashboard-eyebrow">ASSESSMENT DELIVERY</span><h1>Exams & live tracking</h1><p>Publish student links, monitor every live attempt and review outcomes in one place.</p></div><div className="console-head-actions"><button className="workspace-back" onClick={onBack}><ArrowLeft size={16}/> Dashboard</button><button className="exam-copy-link" onClick={() => void load()}><RefreshCw size={15}/> Refresh</button></div></div>{loading ? <p className="console-loading">Loading examinations…</p> : exams.length === 0 ? <div className="exam-empty">No exams yet. Generate a paper, then choose “Create Exam” to publish its student link.</div> : <section className="exam-list-grid">{exams.map(exam => <div key={exam.id} className="exam-list-card" onClick={() => void open(exam)}><header><span className={exam.liveCount ? 'live-badge' : 'exam-state'}>{exam.liveCount ? `${exam.liveCount} live` : exam.status}</span><div className="exam-card-header-right"><span>{new Date(exam.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span><button type="button" onClick={(e) => { e.stopPropagation(); void deleteExam(exam.id, exam.title); }} className="btn-del-exam-card" title="Delete exam"><Trash2 size={14}/></button></div></header><h2>{exam.title}</h2><p>{exam.paper.class_std} · {exam.paper.subject} · {exam.questionCount} questions</p><div className="exam-card-counts"><span><Users/> {exam.attemptCount} attempts</span><span><Radio/> {exam.liveCount} live</span><span><Clock3/> {exam.durationMinutes} min</span></div><footer><span>Open tracking & results</span><BarChart3 size={16}/></footer></div>)}</section>}</main>;
}
