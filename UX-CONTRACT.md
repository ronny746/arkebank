# ARKE Scholars interaction contract

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Select/Listbox | Native `<select>` | `premium-ui.json` | Small fixed faculty filter sets | Keyboard selection and browser popup acceptance |
| Form | Component-owned handlers | Component submit handlers | Search, login, edit and create | `noValidate`, inline error and duplicate-submission checks |
| Scrollbar | `src/app/globals.css` | `DESIGN.md` | Paper question-picker internal surface | Visual desktop and narrow viewport check |
| Toast | Portal shell `showToast` | `src/app/page.tsx` | Success and error feedback | Toast visibility after an action |
| CRUD | Route APIs and workspace navigation | `src/app/api` routes | Paper draft and exam creation | Type-check plus create/read workflow |

## Navigation and scroll ownership

Faculty navigation is route-backed through the portal shell, with a collapsible fixed sidebar. The faculty workspace document scrolls normally; the Paper Studio question picker alone owns an internal question-list scroll during its focused selection step.

## Paper Studio flow

1. **Blueprint:** teacher first selects the assessment target (school board or competitive exam) and test type. Board / exam plus type is the source of truth for permitted question formats and, where prescribed, the time and question count. Competitive patterns remain locked; school chapter/part tests retain teacher controls through visible 1-hour, 2-hour, 3-hour and custom duration slots. Part tests and Full-syllabus papers support selecting one or more eligible subjects, with a clear selected-subject plan; JEE Advanced Part and Full papers are fixed to Physics, Chemistry and Mathematics together. Source: `Paper Generator — Product Vision, Flow & QA Findings.pdf`, pages 3–4.
2. **Pick questions:** teacher chooses chapters within a subject, sees only real question records and usable sub-topics, and adds individual, visible batch, or generated chapter questions without overwriting the draft. For multi-subject papers, each selected Subject → Chapter pair remains intact; selecting a second chapter automatically previews the combined scope, grouped by its own tagged sub-topics, without mixing chapters between subjects. Every selected-scope chip can be inspected or explicitly unselected; unselecting never silently removes questions already added to the paper. Chapters, sub-topics, and subjects with no matching question records are not offered.
3. **Balance & build:** teacher selects language, marks, filters and difficulty before generating the editable paper. Count, duration and formats are read-only when the assessment rules prescribe them. If the teacher has manually picked questions, the target is locked to that exact selection; the system never pads it with unseen questions.

The builder preserves its draft while moving between steps. "Open paper" enters the editing workspace only when at least one question is selected.

Paper preview checks saved papers for repeated question IDs and labels a prior use with the originating paper title. The teacher can use the existing Replace Question or Remove action on the same card before saving.
