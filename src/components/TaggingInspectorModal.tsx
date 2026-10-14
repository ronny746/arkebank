'use client';

import React from 'react';
import { X, Check, Copy, Database, ShieldAlert, Cpu } from 'lucide-react';

interface TaggingInspectorProps {
  question: any | null;
  onClose: () => void;
}

export default function TaggingInspectorModal({ question: q, onClose }: TaggingInspectorProps) {
  const [copied, setCopied] = React.useState(false);

  if (!q) return null;

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(q, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fields = [
    { label: 'Composite Key (_id)', value: q._id },
    { label: 'Base Question ID', value: q.id },
    { label: 'ISO Language Code', value: q.lang },
    { label: 'Academic Class / Standard', value: q.class_std },
    { label: 'Subject Name', value: q.subject },
    { label: 'Subject Taxonomy ID', value: q.subject_id ?? 'None' },
    { label: 'Chapter / Topic Name', value: q.topic },
    { label: 'Topic Taxonomy ID', value: q.topic_id ?? 'None' },
    { label: 'Sub-topic Name', value: q.sub_topic ?? 'None' },
    { label: 'Sub-topic Taxonomy ID', value: q.sub_topic_id ?? 'None' },
    { label: 'Difficulty Level (0-4)', value: q.difficulty ?? 'Not specified' },
    { label: 'Exam Publication Year', value: q.year > 0 ? q.year : 'Unspecified' },
    { label: 'Specific Shift / Paper', value: q.paper ?? 'None' },
    { label: 'PYQ Reference ID', value: q.pyq_id > 0 ? q.pyq_id : 'Standard Curriculum' },
    { label: 'Exam Tags', value: q.question_exams?.length ? q.question_exams.join(', ') : 'None' },
    { label: 'URL Slug Identifier', value: q.q_slug ?? 'None' },
    { label: 'Correct Choice Key', value: q.correct_option ? q.correct_option.toUpperCase() : 'None' },
    { label: 'Numerical Answer', value: q.correct_answer ?? 'None' },
    { label: 'Question Diagram Asset', value: q.question_image || 'None' },
    { label: 'Solution Diagram Asset', value: q.solution_image || 'None' },
    { label: 'Dataset Source URL', value: q.source_url ?? 'Standard Archive' },
    { label: 'ISO Creation Timestamp', value: q.ts ?? 'None' },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box modal-tag-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex-center gap-2">
            <Database className="text-navy" size={20} />
            <div>
              <h3 className="modal-title">Taxonomy & Tagging Inspector</h3>
              <p className="modal-sub">Inspecting Question #{q.id} ({q.class_std} - {q.subject})</p>
            </div>
          </div>
          <div className="flex-center gap-2">
            <button onClick={copyJson} className="btn-secondary-sm">
              {copied ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
              <span>{copied ? 'Copied JSON' : 'Copy Record'}</span>
            </button>
            <button onClick={onClose} className="btn-icon">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="modal-body-scroll">
          <div className="tag-fields-grid">
            {fields.map((f, i) => (
              <div key={i} className="tag-field-card">
                <span className="tag-field-label">{f.label}</span>
                <span className="tag-field-value">{String(f.value)}</span>
              </div>
            ))}
          </div>

          <div className="raw-json-preview">
            <div className="raw-json-header">Raw Document Payload</div>
            <pre className="raw-json-code">
              {JSON.stringify(q, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
