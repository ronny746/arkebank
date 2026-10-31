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

1. **Blueprint:** teacher first selects the assessment target (school board or competitive exam) and test type. Classes 6–8 through 12 are always discoverable so curriculum records can be loaded as they arrive. State board expands to a tenant-managed board list (UP, MP and Karnataka by default); an administrator can add a board without a deployment. Count and visible 1-hour, 2-hour, 3-hour/custom duration slots are collected here exactly once. Competitive patterns remain locked where prescribed; CBSE Maths includes the Numerical format. Part tests and Full-syllabus papers use direct subject checkboxes with Select all and Clear selection controls; an intentionally empty scope remains empty through background taxonomy refreshes. JEE Advanced starts with Physics, Chemistry and Mathematics selected, but each subject remains removable for a faculty-tailored paper; the count reflects its selected subject scope. Step 2 and Step 3 remain disabled until the Blueprint has its required assessment, subject, title, institute, count and duration data; an inline message names every missing item. Source: `Paper Generator — Product Vision, Flow & QA Findings.pdf`, pages 3–4.
2. **Pick questions:** teacher chooses chapters within a subject, sees only real question records and usable sub-topics, and adds individual, visible batch, or generated chapter questions without overwriting the draft. Every preview card makes its question, options, correct answer and solution available before adding it. A Chapter test cannot proceed to Balance & build or generate until at least one chapter is selected; the interface returns the teacher to this step and states why. For multi-subject papers, each selected Subject → Chapter pair remains intact; selecting a second chapter automatically previews the combined scope, grouped by its own tagged sub-topics, without mixing chapters between subjects. Every selected-scope chip can be inspected or explicitly unselected; unselecting never silently removes questions already added to the paper. Chapters, sub-topics, and subjects with no matching question records are not offered. Records with raw HTML or unrenderable LaTex are hidden from teachers and written to the admin formatting-review queue.
3. **Balance & build:** teacher selects language, marks, filters and difficulty before generating the editable paper. It never asks for count or duration again. Difficulty bands are explicit: Easy contains Tiers 0–1, Moderate contains Tier 2, and Tough contains Tiers 3–4. JEE Main and NEET are capped at Tier 3, so their Tough band never includes Expert (Tier 4) questions—both generated and previewed questions respect this cap. Formats are read-only only when the assessment rules prescribe them. If the teacher has manually picked questions, the target is locked to that exact selection; the system never pads it with unseen questions.

The builder preserves its draft while moving between steps. "Open paper" enters the editing workspace only when at least one question is selected.

Paper preview checks saved papers for repeated question IDs and labels a prior use with the originating paper title. The teacher can use the existing Replace Question or Remove action on the same card before saving.

## Exam delivery and results

- A submitted attempt is immutable. When the same student returns to an exam link with the same full name and mobile number, the system finds the completed attempt and opens its result analysis instead of creating a duplicate attempt.
- Students receive score, rank, correct/wrong/unattempted counts, a question-by-question answer comparison, and the stored solution after submission. Non-objective answers are explicitly marked for manual faculty review rather than automatically marked incorrect.
- Faculty tracking uses the same server-side calculation as the student result. Results include the current rank among submitted attempts and an expandable per-student review with selected answer, correct answer, solution, marks, and question media.

## Tenant isolation

- The active tenant is selected solely from the request hostname. `bank.arkescholar.com` serves ARKE and `bank.theprepzo.com` serves Prepzo while retaining one MongoDB deployment.
- Faculty authentication tokens carry the tenant ID and cannot access the other tenant's protected APIs. Each tenant has an independent allowlist configured through `ARKE_ADMIN_EMAILS` or `PREPZO_ADMIN_EMAILS`.
- Papers, exams, attempts, saved-paper activity and public-exam reads are tenant-scoped. The underlying verified question bank remains shared unless a future question-level tenant scope is explicitly introduced.
