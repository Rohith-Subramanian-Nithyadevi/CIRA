# Faculty Frontend Baseline Audit

## Audit scope

This baseline was created from the current working tree on 2026-11-08 before additional transformation work. It covers the React frontend in `frontend-web`. Backend folders, database files, and environment files are out of scope for modification.

## Worktree preservation

The worktree is not clean. Existing modifications and untracked files were observed and are preserved:

- Modified shared/frontend files include `DashboardLayout.tsx`, Faculty dashboard screens, `tailwind.config.js`, and `.vscode/settings.json`.
- `backend-core/src/app.ts` and several backend scratch/seed files are already modified or untracked. They are not part of this frontend task and must not be changed.
- Existing untracked frontend design primitives, demo context/data, and transformation documents are retained.
- The branch is `santhosh_branch`, ahead of `origin/santhosh_branch` by 50 commits.

## Runtime and architecture

- Entry point: `frontend-web/src/App.tsx`.
- Router: React Router with protected `/faculty/dashboard`, `/student/dashboard`, `/admin/dashboard`, and exam portal routes.
- Provider: TanStack Query `QueryClientProvider`; notifications use Sonner.
- API client: `frontend-web/src/lib/apiClient.ts`.
- Styling: Tailwind CSS, CSS variables in `src/index.css`, Inter body text and Outfit heading family.
- Charts: Recharts.
- Rich text: TipTap with DOMPurify used by existing display paths.
- Tests: Jest, jsdom, Testing Library.
- Build: TypeScript project build followed by Vite.

## Faculty screens and workflows

### Faculty entry and shell

- `src/pages/FacultyDashboard.tsx` owns the active Faculty tab and command palette state.
- `src/components/DashboardLayout.tsx` provides the shared sidebar/header/mobile navigation, sign-out, keyboard shortcut registration, and optional Faculty navigation.
- Faculty navigation currently exposes Overview, Students & Reports, Quizzes, Assignments, and My Profile.
- Student and Admin consumers use the same shared layout and must remain behaviorally unchanged.

### Overview

`src/components/dashboard/FacultyHome.tsx` currently contains:

- Tasks: load, create, complete, delete, filter, and retry states.
- Calendar events: load, create, delete, month navigation, and date selection.
- Assignment due-date agenda source.
- Announcements: list, search, survey filter, compose, rich text, targeting, responses, delete, pagination, draft persistence, and retry/empty states.
- Notifications: polling, unread indicator, mark-read action, and notification panel.
- Today agenda assembled from tasks, events, and assignments.
- Faculty demo-mode branches using `src/lib/facultyDemoData.ts`.

### Reports

`src/components/dashboard/StudentReports.tsx` currently supports:

- Branch/batch/department/section/quiz hierarchy.
- Saved report filters.
- Quiz and performance-band data loading.
- Score distribution, topic averages, section comparison, leaderboard, search, print, export, and student profile drill-down.
- Faculty demo data branches.

### Quizzes

`src/components/dashboard/QuizManagement.tsx` contains:

- Quiz list and department loading.
- Create/edit/details flows.
- Question creation/editing and parsing.
- Image/DOCX-related upload paths.
- Draft autosave and saved search filters.
- Answer publication, deletion, attempts/evaluation/restart workflows.
- CSV/print support.
- Faculty demo list and selected local mutations.

### Assignments and grading

- `AssignmentManagement.tsx`: list, search, create/edit, rich text instructions, batch/department/section targeting, delete confirmation, draft persistence, and submission navigation.
- `AssignmentSubmissionsView.tsx`: roster loading, status/search filters, grade validation, feedback, save grading, CSV/print support, and demo roster/local grading.
- `StudentProfileView.tsx`: protected faculty student profile fetch with quiz/assignment tabs.

### Account

`UserProfile.tsx` is shared/role-sensitive and includes profile editing and faculty enrollment-related behavior. It must not be broadly rewritten as part of Faculty visual work.

## Existing API surfaces observed

The frontend uses `apiClient.fetch` and existing contracts including:

- `/api/v1/faculty/dashboard/tasks`
- `/api/v1/faculty/dashboard/calendar`
- `/api/v1/assignments/faculty`
- `/api/v1/faculty/dashboard/announcements`
- `/api/v1/faculty/dashboard/notifications`
- `/api/v1/faculty/dashboard/notifications/:id/read`
- `/api/v1/faculty/dashboard/tasks/:id`
- `/api/v1/faculty/dashboard/calendar/:id`
- `/api/v1/faculty/dashboard/announcements/:id`
- `/api/v1/faculty/dashboard/announcements/:id/responses`
- Faculty quiz routes under `/api/v1/faculty/quiz`
- Faculty student profile route `/api/v1/faculty/students/:studentId/profile`
- Faculty assignment detail/submission/grade routes under `/api/v1/assignments/faculty/:id`

No new endpoint is assumed by this transformation.

## Reusable Student patterns

`StudentSpace.tsx` provides the strongest current visual reference: greeting hierarchy, announcement cards, metric/empty-state composition, and cream/maroon surfaces. Existing shared primitives include `EmptyState`, button/input/card/table/select components, Faculty primitives, CSS tokens, and print utilities. Student-only concepts such as SIS, goals, habits, exam-taking, and student demo records must not be copied into Faculty business logic.

## Confirmed baseline shortcomings

From the current source and supplied screenshots:

- Faculty navigation is functional but only covers the current tab-based screens; several proposed labels do not map to distinct existing workflows.
- Overview contains useful panels but has excessive vertical density variation and exposes internal diagnostic copy such as assignment due-date availability.
- Reports are visually strong but selector hierarchy and single-section states need clearer guidance; demo and live labels must remain distinct.
- Quiz management is functionally dense with many inline actions and very small table typography.
- Assignment cards can render `Invalid Date` when the response lacks a usable date.
- Announcements combine composer and list in one large view, making content management cramped.
- Mobile/tablet behavior needs explicit verification for sidebar, tables, dialogs, charts, and editors.
- Existing loading/error/empty states are uneven across legacy paths.

## Items requiring verification during implementation

- Exact response field availability for aggregate KPI metrics, student totals, due dates, topic data, and activity history.
- Whether any existing Faculty route is intended to be separate from the current tab-based dashboard.
- Browser-level responsive and keyboard behavior at 375, 768, 1024, and 1440 widths.
- Student and Admin regression after any shared-shell change.

## Baseline validation

Before this audit, the available frontend checks were observed to pass:

- `npm run build`
- `npm test -- --watchAll=false --runInBand`
- `npm run lint` (successful with existing warnings)

This document is a regression reference, not a claim that every end-to-end workflow has been browser-verified.
