# Faculty Frontend Upgrade Tracker

| Phase | Task | Status | Files changed | Validation | Outstanding |
|---|---|---|---|---|---|
| 0 | Repository and baseline audit | COMPLETE | `BASELINE_AUDIT.md` | Worktree, package, routes, Faculty/Student source inspection | Browser-level workflow inventory remains to be exercised |
| 1 | Design system and reusable primitives | COMPLETE/PARTIAL | `src/index.css`, `src/components/ui/facultyPrimitives.tsx`, existing Faculty screens | Build and Jest passed before this session | Consolidate usage and verify contrast |
| 2 | Sidebar, header, navigation | COMPLETE/PARTIAL | `DashboardLayout.tsx`, `FacultyDashboard.tsx`, `FacultyCommandPalette.tsx` | Build, Jest, lint; localhost responds | Separate routes are not added because no existing route contract supports them |
| 3 | Faculty overview | COMPLETE/PARTIAL | `FacultyHome.tsx` | Build, Jest, lint; live/demo branches preserved | Unsupported aggregate KPIs remain intentionally omitted |
| 4 | Tasks, calendar, announcements | COMPLETE/PARTIAL | `FacultyHome.tsx` | Build, Jest, lint; demo mutations are local-only | Full authenticated browser workflow still requires user credentials |
| 5 | Student and cohort experience | COMPLETE/PARTIAL | `StudentReports.tsx`, `StudentProfileView.tsx` | Build, Jest, lint | No unsupported student-directory route was invented |
| 6 | Reports and analytics | COMPLETE/PARTIAL | `StudentReports.tsx` | Build, Jest, lint | Data availability remains API-dependent |
| 7 | Quiz management | COMPLETE/PARTIAL | `QuizManagement.tsx` | Build, Jest, lint | Existing dense editor remains functionally preserved |
| 8 | Assignment and grading | COMPLETE/PARTIAL | `AssignmentManagement.tsx`, `AssignmentSubmissionsView.tsx` | Build, Jest, lint | Authenticated grading browser pass remains |
| 9 | Productivity and consistency | COMPLETE | persistence, CSV, command palette, Faculty screens | 8 Jest suites / 20 tests passed | — |
| 10 | Responsive/accessibility | COMPLETE/PARTIAL | shared shell and Faculty screens | Build, Jest, lint; responsive classes and mobile drawer present | Manual authenticated visual pass recommended |
| 11 | Regression and final polish | COMPLETE/PARTIAL | Faculty frontend changes | Build, Jest, lint; localhost HTTP 200 | Full authenticated workflow regression requires credentials |

## Current session next work

1. Make only frontend changes.
2. Remove faculty-facing diagnostic strings while retaining useful retry/error states.
3. Add safe date formatting for assignment cards and agenda data.
4. Improve shell and screen responsiveness without changing Student/Admin defaults.
5. Add focused tests for the changed behavior.

## Latest validation

- `npm run build`: passed; Vite emits the pre-existing Tailwind/lightningcss `@theme` warning.
- `npm test -- --watchAll=false --runInBand`: 8 suites passed, 20 tests passed.
- `npm run lint`: completed with warnings already present in the repository.
- Local server: `http://localhost:5175` responds with HTTP 200; unauthenticated Faculty navigation correctly redirects to `/login`.
- Dark mode: persisted theme bootstrap verified in browser; `cira_theme=dark` reloads with the document `dark` class.
