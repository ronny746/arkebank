# ARKE Scholars UI context

## Product and audience

ARKE Scholars is a faculty-facing question-bank and assessment workspace, with a secure student exam surface. Faculty need dense operational information without losing clarity; students need a calm, full-screen test-taking environment.

## Visual system

- **Primary:** `--primary-navy` for navigation, hierarchy and primary controls.
- **Success / live state:** `--brand-emerald` for positive state, active delivery and secure-assessment cues.
- **Canvas:** `--bg-slate` with `--bg-white` surfaces and `--card-border` separators.
- **Text:** `--text-dark` for primary reading, `--text-body` and `--text-muted` for supporting detail.
- **Geometry:** compact 6–14px radii; subtle shadows only for elevation; responsive wide workspaces should use available width rather than centre a narrow card.

## Layout contracts

- Dashboard and management workspaces are document-scrolling, wide faculty canvases.
- Student exam delivery is its own full-viewport route: a stable top bar, a large question region, a right-side question palette and a fixed action bar on desktop.
- Live tracking refreshes safely without moving the selected exam or current results tab.
- Status has a text label in addition to color. Security events use explicit counts.

## Runtime ownership

Tokens are defined in `src/app/globals.css`. Shared faculty, exam-control and student-exam classes in the same stylesheet consume those tokens; feature components do not define independent palette values.

## Tenant-aware brand shell

The faculty login, application header, browser metadata, and student exam shell resolve their logo and name from the request hostname. Tenant branding changes identity only; the interaction model, design tokens, accessible controls, and layout contracts remain consistent across ARKE and Prepzo.
