# Faculty Upgrade Implementation Tracker

> Phase names and ordering follow `docs/faculty-upgrade/SPEC.md` section 22. Columns follow section 23.

| Phase | Feature | Status | Frontend files | Backend files | Tests | Outstanding issues |
|---|---|---|---|---|---|---|
| 0 | Repository Audit and Baseline | Completed (audit) | Ã¢â‚¬â€ | Ã¢â‚¬â€ | Not run; docs-only audit | `backend-ai` source is missing; bytecode-only remnants are not auditable. |
| 1 | Faculty Authentication and Access Rules | Verified | `frontend-web/src/pages/Login.tsx`, `frontend-web/src/lib/facultyEmail.ts` | `backend-core/src/controllers/auth.controller.ts`, `backend-core/src/controllers/faculty.controller.ts`, `backend-core/src/routes/faculty.routes.ts`, `backend-core/src/middlewares/faculty-scope.middleware.ts`, `backend-core/src/services/faculty-scope.service.ts`, `backend-core/src/controllers/student-exam.controller.ts`, `backend-core/src/utils/faculty-security.ts` | Backend `npm test`: 18 tests passed including security tests; frontend Jest: 12 suites / 37 tests passed; backend and frontend builds pass. | Browser-session automation cannot be distinguished from a human using an authenticated student session. AI service source is absent from checkout. |
| 2 | Student Reports and Student Management | Verified | `frontend-web/src/components/dashboard/StudentReports.tsx`, `frontend-web/src/components/dashboard/StudentReports.test.tsx`, `frontend-web/src/components/dashboard/FacultyStudentsDirectory.tsx`, `frontend-web/src/components/dashboard/FacultyStudentsDirectory.test.tsx`, `frontend-web/src/pages/FacultyDashboard.tsx` | `backend-core/src/controllers/faculty-reports.controller.ts`, `backend-core/src/controllers/faculty.controller.ts`, `backend-core/src/controllers/auth.controller.ts`, `backend-core/src/routes/faculty-reports.routes.ts`, `backend-core/src/routes/faculty.routes.ts`, `backend-core/src/services/password-reset.service.ts`, `backend-core/src/utils/faculty-student-scope.ts`, `backend-core/tests/security.test.cjs` | Backend `npm test`: 18 tests passed; frontend Jest: 12 suites / 37 tests passed; backend and frontend builds pass. | No audit-log model or service exists, so reset requests are not separately audit logged. Recovery flow requires a personal email; Google-auth accounts must use Google. Browser-session automation limitation remains as documented in the security report. |
| 3 | Dedicated Question Bank | Verified | `frontend-web/src/components/dashboard/QuestionBank.tsx`, `frontend-web/src/components/dashboard/QuestionBank.test.tsx`, `frontend-web/src/pages/FacultyDashboard.tsx`, `frontend-web/src/pages/exam-portal/ExamInterface.tsx` | `backend-core/prisma/schema.prisma`, `backend-core/prisma/migrations/20261109090000_question_bank/migration.sql`, `backend-core/src/controllers/question-bank.controller.ts`, `backend-core/src/controllers/quiz.controller.ts`, `backend-core/src/routes/quiz.routes.ts`, `backend-core/src/utils/cloudinary.ts`, `backend-core/src/utils/question-bank-policy.ts`, `backend-core/src/controllers/student-exam.controller.ts`, `backend-core/tests/security.test.cjs` | Prisma format/validate/generate passed; backend `npm test`: 29 tests passed; frontend Jest: 13 suites / 44 tests passed; backend and frontend builds pass. | Migration is additive but has not been applied to a database. Existing MongoDB import collection is separate and has no list/usage API; existing quiz questions and the Prisma Question model now power the managed bank. Assignment usage writes are available in the schema for the next assessment-paper phase; current assignment subsystem has no question set to associate. |
| 4 | Question Paper Creation and Publishing | Implemented | `frontend-web/src/components/dashboard/QuestionPaperManagement.tsx`, `frontend-web/src/components/dashboard/QuestionPaperManagement.test.tsx`, `frontend-web/src/pages/FacultyDashboard.tsx`, `frontend-web/src/components/dashboard/QuizManagement.tsx`, `frontend-web/src/index.css` | `backend-core/prisma/schema.prisma`, `backend-core/prisma/migrations/20261110090000_question_papers/migration.sql`, `backend-core/src/controllers/question-paper.controller.ts`, `backend-core/src/controllers/student-exam.controller.ts`, `backend-core/src/routes/quiz.routes.ts`, `backend-core/src/utils/question-paper-policy.ts`, `backend-core/tests/question-paper.test.cjs`, `backend-core/tests/security.test.cjs` | Prisma validation passed; backend `npm test`: build + 33 tests passed; frontend `npm test`: 14 suites / 45 tests passed; frontend production build passed with existing CSS at-rule and bundle-size warnings. | Migration is additive and not applied to a database. PDF uses browser print / Save as PDF and was not verified in a real browser. |
| 5 | Announcements, Polls and Notifications | Completed | `frontend-web/src/components/dashboard/FacultyHome.tsx`, `frontend-web/src/components/dashboard/FacultyPolls.tsx`, `frontend-web/src/components/dashboard/FacultyPolls.test.tsx`, `frontend-web/src/components/dashboard/StudentSpace.tsx`, `frontend-web/src/components/dashboard/FacultyNotifications.tsx`, `frontend-web/src/components/dashboard/FacultyNotifications.test.tsx`, `frontend-web/src/components/DashboardLayout.tsx`, `frontend-web/src/pages/FacultyDashboard.tsx` | `backend-core/prisma/schema.prisma`, `backend-core/prisma/migrations/20261111090000_announcement_polls/migration.sql`, `backend-core/src/controllers/announcement-poll.controller.ts`, `backend-core/src/controllers/faculty-dashboard.controller.ts`, `backend-core/src/controllers/student-dashboard.controller.ts`, `backend-core/src/controllers/student.controller.ts`, `backend-core/src/routes/faculty-dashboard.routes.ts`, `backend-core/tests/announcement-poll.test.cjs`, `backend-core/tests/security.test.cjs` | Prisma validation passed; backend `npm test`: build + 41 tests passed; frontend `npm test`: 16 suites / 50 tests passed; frontend build passed with existing CSS at-rule and bundle-size warnings. | Poll schema migration is additive and not applied. Notifications use the existing schema and API; title/category/destination are derived from notification type. |
| 6 | Faculty Profile and Navigation Cleanup | Completed | `frontend-web/src/components/dashboard/UserProfile.tsx`, `frontend-web/src/components/dashboard/UserProfile.test.tsx`, `frontend-web/src/pages/FacultyDashboard.tsx`, `frontend-web/src/pages/FacultyDashboard.test.tsx`, `frontend-web/src/App.tsx`, `frontend-web/src/App.test.tsx` | `backend-core/src/utils/faculty-security.ts`, `backend-core/tests/security.test.cjs` | Frontend Jest: 19 suites / 58 tests passed; focused tests: 3 suites / 8 tests passed; frontend build passed; backend npm test (build + 41 tests) passed. | Faculty profile data is read-only; password changes use the existing endpoint with login-matching strength rules. Google-managed credentials must be changed through Google; the backend provides that guidance. Faculty enrollment APIs and admin enrollment remain intact. |
| 7 | Responsive Design and UX Polish | Completed | `frontend-web/src/components/DashboardLayout.tsx`, `frontend-web/src/components/dashboard/FacultyHome.tsx`, `frontend-web/src/components/dashboard/FacultyPolls.tsx`, `frontend-web/src/components/dashboard/FacultyNotifications.tsx`, `frontend-web/src/components/dashboard/QuestionBank.tsx`, `frontend-web/src/components/dashboard/QuestionPaperManagement.tsx`, `frontend-web/src/components/dashboard/StudentReports.tsx`, `frontend-web/src/components/dashboard/StudentProfileView.tsx`, `frontend-web/src/components/dashboard/StudentSpace.tsx`, `frontend-web/src/components/dashboard/UserProfile.tsx`, `frontend-web/src/index.css` | — | Frontend Jest: 19 suites / 58 tests passed; frontend build passed with existing CSS at-rule and bundle-size warnings. Headless Chrome viewport smoke checked 9 faculty tabs at 375, 430, 768, 1024 and 1440px with no document or main-content horizontal overflow. | Data-backed charts, tables and dialogs were reviewed in source and existing fixture tests; browser walkthrough used API error states because the backend was not running. |
| 8 | Full Integration, Security and Regression QA | Completed with limitations | Docs only | Docs only | Frontend build/lint/typecheck/Jest and backend build/typecheck/node:test passed; see `FINAL_REPORT.md`. | No live database or backend/browser integrated run; no backend lint script; AI service source unavailable; populated browser states and print-to-PDF not exercised. |


## Phase 7 viewport and motion audit

- Headless Chrome measured the Faculty Dashboard at 375px, 430px, 768px, 1024px and 1440px. Overview, Student Directory, Student Reports, Quizzes, Assignments, Question Bank, Question Papers, Notifications and My Profile were selected at each width (45 tab/width checks). The document and main-content scroll widths matched their available widths after the calendar header and mobile shell adjustments.
- At 375px, the first screenshot showed horizontal overflow from the calendar heading and month controls. The heading now wraps, the calendar card uses mobile padding, and the date grid reduces its gaps on narrow screens. A follow-up screenshot showed no horizontal scrollbar.
- Source and fixture-test review covered report filters and chart containers, horizontally scrollable student/assessment tables, question editor/image previews, paper list/editor/print preview, poll editor/results, student profile tabs/charts, notification popover/page, and password reset/profile actions. The browser run used API error states because backend services were not running; populated charts, data rows and open dialogs were not visually exercised in Chrome.
- Added a `prefers-reduced-motion` rule that shortens transitions and animation timing while keeping loading indicator elements and their visible spinner shapes in place. Removed nonessential view fades, card lifts, and a decorative report-card blur; softened modal shadows.
## Phase 0 files

- `BASELINE_AUDIT.md`
- `IMPLEMENTATION_TRACKER.md`
- `API_AND_DATA_DEPENDENCIES.md`
- `SECURITY_AND_REGRESSION_REPORT.md`

## Phase 0 validation

- Ran `git status --short --branch`: branch is `santhosh_branch`, ahead 1; pre-existing changes are listed in `BASELINE_AUDIT.md`.
- Inspected the frontend, backend routes/controllers/middleware, Prisma schema and migrations directory, Mongoose models and relevant frontend consumers.
- Read SPEC sections 2, 4.2Ã¢â‚¬â€œ4.4, 22 and 23 after the file became available.
- Tests/builds: not run (documentation-only audit; no application code changed).
- Outstanding: `backend-ai` has no `.py` source files to audit. Existing dirty working-tree files remain untouched; no commit was created.

## Phase 8 final QA record (2026-11-09)

- `frontend-web`: `npm run build` passed; `npm run lint -- --quiet` passed; `npx tsc -b --pretty false` passed; `npm test` passed (19 suites, 58 tests).
- `backend-core`: `npm run build` passed; `npx tsc --noEmit` passed; `npm test` passed (11 suites, 41 tests). `npm run lint` is unavailable because the package has no `lint` script. As a fallback, frontend-installed oxlint was run on `backend-core/src` and exited 0 with warnings.
- Regression checklist and 30 DoD items are classified by evidence in `SECURITY_AND_REGRESSION_REPORT.md` and `FINAL_REPORT.md`. A passing unit/component suite is not represented as a live integration run.
- Browser viewport smoke evidence from Phase 7 covers 9 faculty tabs at 375, 430, 768, 1024 and 1440 CSS pixels and confirms no document/main horizontal overflow. That run used API error states because no backend was running; populated pages/dialogs and browser print output were not verified there.
- No application code was changed in Phase 8. No migration was applied and no live DB was used. Existing unrelated working-tree changes were left untouched.
- Remaining: run against an initialized database and live API; verify the unavailable AI service/deployed identity integration; run populated end-to-end workflows and actual print-to-PDF; consider adding a backend lint script and broader regression E2E coverage.

## Follow-up: Vite missing stylesheet import (2026-11-09)

- Removed the stale `@import "shadcn/tailwind.css"` from `frontend-web/src/index.css`; the installed `shadcn` package does not provide that file. Tailwind directives and the separate `tw-animate-css` import remain.
- `frontend-web: npm run build` passed after the change. Existing lightningcss at-rule, Vite config and bundle-size warnings remain.
- Frontend Jest was not rerun as part of this CSS-only fix; the current working `package.json` has Jest 25 while `jest-environment-jsdom` is 30, which causes all suites to fail during environment initialization.

## Follow-up: Faculty assessment error messages (2026-11-10)

- Generic server errors no longer return raw exception messages or development stack traces to clients. Prisma missing-column errors return a plain-language temporary-availability message; internal details remain in server logs.
- Question Bank and Question Papers use user-facing fallback copy for other server failures and omit internal error codes from those messages.
- Backend and frontend production builds passed. Automated tests were not run for this follow-up; the existing frontend Jest/jsdom version mismatch remains outstanding.


## Follow-up: Review & Proctoring Enhancements (Items 4-14, 23, 24) (2026-11-14)

- **Items Implemented**:
  - `4.` Question shuffling to ensure randomized question order per student attempt, persisted deterministically across resumes.
  - `5.` Prevention of duplicate questions in quizzes and Question Bank selection validation.
  - `6.` Removal of distracting animations and bouncing scale effects across the exam portal interface.
  - `7.` Implemented Topic selection as a dropdown menu populated with curriculum topics across Question Bank, Question Papers, and Quiz Management.
  - `8.` Made instructions optional during quiz and question paper creation.
  - `9.` Fixed question image display (support for mammoth DOCX image parsing to Neon Object Storage / base64 data URIs, container visibility fix).
  - `10.` 30-second rolling TOTP access code generation with countdown timer and server-side verification.
  - `11.` Instant screen locking during active quizzes upon proctor flag or security violation.
  - `12.` Buffered keylogging captured at 1.5s intervals with multi-window interval reporting (1.5s, 5s, 30s, 1m, full session).
  - `13.` Privacy blackout protection screen triggered on focus loss or privacy events.
  - `14.` Overlay detection for desktop and mobile devices triggering blackout and logging violation telemetry.
  - `23.` Faculty edit mark toggle for objective questions on submitted attempts.
  - `24.` Manual mark entry for unsubmitted/offline student attempts.
- **Validation**:
  - `backend-core`: `npm test` passed (16 test suites, 66 tests passed).
  - `frontend-web`: `npm test` passed (24 test suites, 94 tests passed).
  - Production builds: `npm --prefix backend-core run build` and `npm --prefix frontend-web run build` passed with 0 errors.
