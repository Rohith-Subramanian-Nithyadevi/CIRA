# Faculty Upgrade Implementation Tracker

> Phase names and ordering follow `docs/faculty-upgrade/SPEC.md` section 22. Columns follow section 23.

| Phase | Feature | Status | Frontend files | Backend files | Tests | Outstanding issues |
|---|---|---|---|---|---|---|
| 0 | Repository Audit and Baseline | Completed (audit) | Ã¢â‚¬â€ | Ã¢â‚¬â€ | Not run; docs-only audit | `backend-ai` source is missing; bytecode-only remnants are not auditable. |
| 1 | Faculty Authentication and Access Rules | Verified | `frontend-web/src/pages/Login.tsx`, `frontend-web/src/lib/facultyEmail.ts` | `backend-core/src/controllers/auth.controller.ts`, `backend-core/src/controllers/faculty.controller.ts`, `backend-core/src/routes/faculty.routes.ts`, `backend-core/src/middlewares/faculty-scope.middleware.ts`, `backend-core/src/services/faculty-scope.service.ts`, `backend-core/src/controllers/student-exam.controller.ts`, `backend-core/src/utils/faculty-security.ts` | Backend `npm test`: 18 tests passed including security tests; frontend Jest: 12 suites / 37 tests passed; backend and frontend builds pass. | Browser-session automation cannot be distinguished from a human using an authenticated student session. AI service source is absent from checkout. |
| 2 | Student Reports and Student Management | Verified | `frontend-web/src/components/dashboard/StudentReports.tsx`, `frontend-web/src/components/dashboard/StudentReports.test.tsx`, `frontend-web/src/components/dashboard/FacultyStudentsDirectory.tsx`, `frontend-web/src/components/dashboard/FacultyStudentsDirectory.test.tsx`, `frontend-web/src/pages/FacultyDashboard.tsx` | `backend-core/src/controllers/faculty-reports.controller.ts`, `backend-core/src/controllers/faculty.controller.ts`, `backend-core/src/controllers/auth.controller.ts`, `backend-core/src/routes/faculty-reports.routes.ts`, `backend-core/src/routes/faculty.routes.ts`, `backend-core/src/services/password-reset.service.ts`, `backend-core/src/utils/faculty-student-scope.ts`, `backend-core/tests/security.test.cjs` | Backend `npm test`: 18 tests passed; frontend Jest: 12 suites / 37 tests passed; backend and frontend builds pass. Latest roll-number ordering change: backend build and focused `security.test.cjs` (36 tests) passed. | No audit-log model or service exists, so reset requests are not separately audit logged. Recovery flow requires a personal email; Google-auth accounts must use Google. Browser-session automation limitation remains as documented in the security report. |
| 3 | Dedicated Question Bank | Verified | `frontend-web/src/components/dashboard/QuestionBank.tsx`, `frontend-web/src/components/dashboard/QuestionBank.test.tsx`, `frontend-web/src/pages/FacultyDashboard.tsx`, `frontend-web/src/pages/exam-portal/ExamInterface.tsx` | `backend-core/prisma/schema.prisma`, `backend-core/prisma/migrations/20261109090000_question_bank/migration.sql`, `backend-core/src/controllers/question-bank.controller.ts`, `backend-core/src/controllers/quiz.controller.ts`, `backend-core/src/routes/quiz.routes.ts`, `backend-core/src/utils/cloudinary.ts`, `backend-core/src/utils/question-bank-policy.ts`, `backend-core/src/controllers/student-exam.controller.ts`, `backend-core/tests/security.test.cjs` | Prisma format/validate/generate passed; backend `npm test`: 29 tests passed; frontend Jest: 13 suites / 44 tests passed; backend and frontend builds pass. | Migration is additive but has not been applied to a database. Existing MongoDB import collection is separate and has no list/usage API; existing quiz questions and the Prisma Question model now power the managed bank. Assignment usage writes are available in the schema for the next assessment-paper phase; current assignment subsystem has no question set to associate. |
| 4 | Question Paper Creation and Publishing | Implemented | `frontend-web/src/components/dashboard/QuestionPaperManagement.tsx`, `frontend-web/src/components/dashboard/QuestionPaperManagement.test.tsx`, `frontend-web/src/pages/FacultyDashboard.tsx`, `frontend-web/src/components/dashboard/QuizManagement.tsx`, `frontend-web/src/index.css` | `backend-core/prisma/schema.prisma`, `backend-core/prisma/migrations/20261110090000_question_papers/migration.sql`, `backend-core/src/controllers/question-paper.controller.ts`, `backend-core/src/controllers/student-exam.controller.ts`, `backend-core/src/routes/quiz.routes.ts`, `backend-core/src/utils/question-paper-policy.ts`, `backend-core/tests/question-paper.test.cjs`, `backend-core/tests/security.test.cjs` | Prisma validation passed; backend `npm test`: build + 33 tests passed; frontend `npm test`: 14 suites / 45 tests passed; frontend production build passed with existing CSS at-rule and bundle-size warnings. | Migration is additive and not applied to a database. PDF uses browser print / Save as PDF and was not verified in a real browser. |
| 5 | Announcements, Polls and Notifications | Completed | `frontend-web/src/components/dashboard/FacultyHome.tsx`, `frontend-web/src/components/dashboard/FacultyPolls.tsx`, `frontend-web/src/components/dashboard/FacultyPolls.test.tsx`, `frontend-web/src/components/dashboard/StudentSpace.tsx`, `frontend-web/src/components/dashboard/FacultyNotifications.tsx`, `frontend-web/src/components/dashboard/FacultyNotifications.test.tsx`, `frontend-web/src/components/DashboardLayout.tsx`, `frontend-web/src/pages/FacultyDashboard.tsx` | `backend-core/prisma/schema.prisma`, `backend-core/prisma/migrations/20261111090000_announcement_polls/migration.sql`, `backend-core/src/controllers/announcement-poll.controller.ts`, `backend-core/src/controllers/faculty-dashboard.controller.ts`, `backend-core/src/controllers/student-dashboard.controller.ts`, `backend-core/src/controllers/student.controller.ts`, `backend-core/src/routes/faculty-dashboard.routes.ts`, `backend-core/tests/announcement-poll.test.cjs`, `backend-core/tests/security.test.cjs` | Prisma validation passed; backend `npm test`: build + 41 tests passed; frontend `npm test`: 16 suites / 50 tests passed; frontend build passed with existing CSS at-rule and bundle-size warnings. | Poll schema migration is additive and not applied. Notifications use the existing schema and API; title/category/destination are derived from notification type. |
| 6 | Faculty Profile and Navigation Cleanup | Completed | `frontend-web/src/components/dashboard/UserProfile.tsx`, `frontend-web/src/components/dashboard/UserProfile.test.tsx`, `frontend-web/src/pages/FacultyDashboard.tsx`, `frontend-web/src/pages/FacultyDashboard.test.tsx`, `frontend-web/src/App.tsx`, `frontend-web/src/App.test.tsx` | `backend-core/src/utils/faculty-security.ts`, `backend-core/tests/security.test.cjs` | Frontend Jest: 19 suites / 58 tests passed; focused tests: 3 suites / 8 tests passed; frontend build passed; backend npm test (build + 41 tests) passed. | Faculty profile data is read-only; password changes use the existing endpoint with login-matching strength rules. Google-managed credentials must be changed through Google; the backend provides that guidance. Faculty enrollment APIs and admin enrollment remain intact. |
| 7 | Responsive Design and UX Polish | Completed | `frontend-web/src/components/DashboardLayout.tsx`, `frontend-web/src/components/dashboard/FacultyHome.tsx`, `frontend-web/src/components/dashboard/FacultyPolls.tsx`, `frontend-web/src/components/dashboard/FacultyNotifications.tsx`, `frontend-web/src/components/dashboard/QuestionBank.tsx`, `frontend-web/src/components/dashboard/QuestionPaperManagement.tsx`, `frontend-web/src/components/dashboard/StudentReports.tsx`, `frontend-web/src/components/dashboard/StudentProfileView.tsx`, `frontend-web/src/components/dashboard/StudentSpace.tsx`, `frontend-web/src/components/dashboard/UserProfile.tsx`, `frontend-web/src/index.css` | — | Frontend Jest: 19 suites / 58 tests passed; frontend build passed with existing CSS at-rule and bundle-size warnings. Headless Chrome viewport smoke checked 9 faculty tabs at 375, 430, 768, 1024 and 1440px with no document or main-content horizontal overflow. | Data-backed charts, tables and dialogs were reviewed in source and existing fixture tests; browser walkthrough used API error states because the backend was not running. |
| 8 | Full Integration, Security and Regression QA | Completed with limitations | Docs only | Docs only | Frontend build/lint/typecheck/Jest and backend build/typecheck/node:test passed; see `FINAL_REPORT.md`. | No live database or backend/browser integrated run; no backend lint script; AI service source unavailable; populated browser states and print-to-PDF not exercised. |
| 9 | Standalone Administration Views Restoration | Verified | `frontend-web/src/pages/FacultyDashboard.tsx`, `frontend-web/src/pages/FacultyDashboard.test.tsx`, `frontend-web/src/components/DashboardLayout.tsx`, `frontend-web/src/components/dashboard/FacultyManagement.tsx` | — | Frontend Jest: 26 suites / 103 tests passed; `npm run build --prefix frontend-web` (`tsc -b && vite build`) passed with 0 errors. | Clean standalone views restored for Faculty Approvals, User Management (students only with filters/profiles), and Departments (3-column layout) with redundant wrappers and sub-tab bars removed. |
| 10 | Exclusive Admin Class Assignment & Self-Enrollment Removal | Verified | `frontend-web/src/components/dashboard/UserProfile.tsx`, `frontend-web/src/components/dashboard/FacultyManagement.tsx` | `backend-core/src/controllers/admin.controller.ts`, `backend-core/src/controllers/faculty.controller.ts`, `backend-core/src/routes/admin.routes.ts`, `backend-core/src/routes/faculty.routes.ts`, `backend-core/tests/faculty-class-assignment.test.cjs` | Backend unit tests: 3 passed (`faculty-class-assignment.test.cjs`); full backend test runner: 22 suites / 88 tests passed; frontend Jest: 26 suites / 107 tests passed; backend (`tsc`) and frontend (`vite build`) builds passed with 0 errors. | Faculty self-enrollment disabled end-to-end; faculty profile shows read-only assigned class badges; admin assigns whole departments or specific sections with pre-populated multi-select modal and atomic Prisma transaction. |


## Phase 7 viewport and motion audit

- Headless Chrome measured the Faculty Dashboard at 375px, 430px, 768px, 1024px and 1440px. Overview, Student Directory, Student Reports, Quizzes, Assignments, Question Bank, Question Papers, Notifications and My Profile were selected at each width (45 tab/width checks). The document and main-content scroll widths matched their available widths after the calendar header and mobile shell adjustments.
- At 375px, the first screenshot showed horizontal overflow from the calendar heading and month controls. The heading now wraps, the calendar card uses mobile padding, and the date grid reduces its gaps on narrow screens. A follow-up screenshot showed no horizontal scrollbar.
- Source and fixture-test review covered report filters and chart containers, horizontally scrollable student/assessment tables, question editor/image previews, paper list/editor/print preview, poll editor/results, student profile tabs/charts, notification popover/page, and password reset/profile actions. The browser run used API error states because backend services were not running; populated charts, data rows and open dialogs were not visually exercised in Chrome.
- Added a `prefers-reduced-motion` rule that shortens transitions and animation timing while keeping loading indicator elements and their visible spinner shapes in place. Removed nonessential view fades, card lifts, and a decorative report-card blur; softened modal shadows.
- Student Reports now uses the shared full-page accessible loader until the initial authorized-filter request settles, rather than rendering empty report content. The focused StudentReports Jest suite (2 tests) and frontend build passed.
## Phase 0 files

- `BASELINE_AUDIT.md`
- `IMPLEMENTATION_TRACKER.md`
- `API_AND_DATA_DEPENDENCIES.md`
- `SECURITY_AND_REGRESSION_REPORT.md`

## Additional source-based reports

- `../QUESTION_GENERATION_PIPELINE_REPORT.md` documents the current assignment/test question workflows and notes the unavailable AI-service source. Documentation-only; no tests were run.

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


## Follow-up: Question Pool Subset Sampling & Randomized Delivery (2026-11-14)

- **Feature**:
  - Added option in Quiz creation / editing for faculty to configure a question pool with subset sampling (`questionPoolCount`).
  - Added "Question Pool & Subset Sampling" input in Step 3 (Marks Configuration) and pool metrics across Step 5 and the questions review view.
  - When a student initiates the exam (`startExam`), if `questionPoolCount` is set, a non-repeated subset of $K$ questions is randomly sampled from the total pool ($N$) using Fisher-Yates shuffle with a deterministic per-student attempt seed (`${attempt.id}-${userId}-${quizId}`).
  - Each student receives a unique, non-repeated, randomly shuffled question set.
  - The sampled subset and shuffle sequence are stored in `attempt.metrics.questionOrder`, ensuring that page refreshes or session resumes deterministically preserve the exact same subset and question order for that student.
  - Quiz total marks for the attempt automatically adjust to match the assigned subset.
- **Validation**:
  - Added `backend-core/tests/student-exam-pool-shuffle.test.cjs` verifying subset selection, absence of repeated questions, unique per-student permutations, resume preservation, and marks calculation.
  - `backend-core`: 17 suites, 67 tests passed, 0 failures.
  - `frontend-web`: 24 suites, 94 tests passed, 0 failures.
  - Production builds (`npm run build` in both backend-core and frontend-web) completed with 0 errors.


## Follow-up: Topic Selection When Pasting Bulk Questions (2026-11-14)

- **Feature**:
  - Added a Topic selection dropdown menu directly in **Mode 1: Paste Textboxes** (Step 5 of Quiz Creation) and in the **Quick Paste Additional Questions** modal during quiz question review/editing.
  - Faculty can select any predefined curriculum topic or specify a custom topic from the dropdown while pasting questions into the textboxes.
  - Updated all bulk text parsers (`parseMCQs`, `parseShortWritten`, `parseNumerical`, `parseLongWritten`, `parseMatching`, `parseFillBlanks`) to check for per-question `Topic: <value>` or `Subject: <value>` lines in the pasted text.
  - When questions are converted and added to the quiz via `handleImportBulkQuestions`, any question without an explicit in-text topic automatically inherits the topic chosen from the dropdown.
- **Validation**:
  - `frontend-web`: 24 test suites, 94 tests passed, 0 failures.
  - `frontend-web run build`: `tsc -b && vite build` passed with 0 errors.
  - `backend-core`: 17 test suites, 67 tests passed, 0 failures.

## Follow-up: 30-Second Rotating Classroom OTP & Single-Session Device Lock (2026-11-17)

- **Feature**:
  - **Strict 30-Second Rotating OTP**: Updated `totp.ts` to enforce strict 30-second window validity with a maximum 3-second boundary drift tolerance. Accepts cleanly formatted inputs with or without spaces (`739 204` or `739204`).
  - **Single-Session Device Lock**: On OTP verification (`verifyQuizAccessOtp`), generates a cryptographically random UUID `attemptSessionToken` saved on the attempt metrics and stored in client `sessionStorage`. Validates session tokens across `startExam`, `saveResponse`, and `submitExam`, completely preventing concurrent logins or session sharing from secondary devices.
  - **Pre-Exam Security Arming**: In `ExamInterface.tsx`, as soon as student clicks "Begin Quiz", Fullscreen mode is entered and zero-tolerance cheat monitoring (`useSecureExam`, tab switches, window blurs, fullscreen change, copy/paste guards) is armed immediately before the OTP modal appears. Any tab or window switch during the OTP verification phase is permanently logged as a violation (`Window/Tab switch during OTP verification`) and terminates the attempt.
  - **Faculty Classroom Screen & Projector Mode**:
    - High-visibility "Classroom Entry OTP" card in View Submissions with spaced 6-digit display (`739 204`) and 30-second circular countdown ring.
    - Fullscreen "Projector View" modal designed for lecture hall projection with giant 6-digit typography, 30s countdown ring, and ESC key dismissal.
    - "Lock Entry" toggle button to instantly freeze new student verifications once the exam commences.
- **Validation**:
  - Added `backend-core/tests/classroom-otp.test.cjs` covering TOTP validity, 30s boundary tolerance, entry lock toggle, OTP verification, question shuffling, and single-session device lock rejection.
  - Added `frontend-web/src/pages/exam-portal/ClassroomOtpGate.test.tsx` verifying fullscreen entry, proctoring activation, inline error handling, and OTP verification flow.
  - Added tests in `QuizManagement.test.tsx` verifying Live OTP card, Projector modal, and Lock Entry toggle.
  - `backend-core`: All 12 test suites passed (46 tests, 0 failures).
  - `frontend-web`: All 27 test suites passed (100 tests, 0 failures).
  - Production builds (`npm run build` in both `backend-core` and `frontend-web`) completed with 0 errors.

## Follow-up: Faculty Notification Popover Overlay (2026-11-17)

- **Feature**:
  - Rendered the notification popover in a body portal with fixed, viewport-aware positioning so it is not clipped or hidden by the dashboard header or scrolling content.
  - Constrained the panel to available viewport space and added outside-click and Escape-key dismissal.
- **Validation**:
  - `FacultyNotifications.test.tsx`: 4 tests passed, including portal layering, anchoring, and dismissal.
  - `npx tsc --project tsconfig.app.json --noEmit --noUnusedLocals false` passed. `oxlint` exited 0 with existing fast-refresh warnings.
  - `npx vite build` passed with existing CSS/config/bundle warnings. `npm run build` remains blocked at TypeScript checking by an unused `waitFor` import in `frontend-web/src/pages/exam-portal/ClassroomOtpGate.test.tsx` from the recent `main` merge; that unrelated file was left unchanged.

## Follow-up: Removal of Behavioral Proctoring Thresholds, Heuristic Flags, and Risk Categorization (2026-11-17)

- **Objective**:
  - Remove all behavioral proctoring thresholds, heuristic violation flags, and risk-score categorizations (`LOW` / `MEDIUM` / `HIGH`) to return to a clean baseline before future research.
- **Removed**:
  - **Behavioral Thresholds & Telemetry**:
    - Deleted `frontend-web/src/hooks/useBehavioralTelemetry.ts` and `frontend-web/src/hooks/useBehavioralTelemetry.test.tsx` (TTFI `< 1800ms`, `fastAnswers`, `zeroEntropyClicks`, `syntheticClicks`, click coordinate tracking).
    - Removed per-question auto-advance throttling timer (`perQuestionLimit`, `questionTimeLeft`) from `ExamInterface.tsx`.
    - Removed `onClick` telemetry verification from question option labels in `ExamInterface.tsx`.
    - Removed `integrityReport` from `submitExam` and `handleSecurityViolation` payloads.
  - **Risk Categorization & Scoring Logic**:
    - Removed `calculateRiskScore` and `integrityReport` processing in `backend-core/src/controllers/student-exam.controller.ts`.
    - Removed `riskScore` and `integrityReport` projection from `backend-core/src/controllers/quiz.controller.ts`.
    - Removed risk-level badges (`LOW`, `MEDIUM`, `HIGH`) and synthetic click counts from Faculty Submissions table in `frontend-web/src/components/dashboard/QuizManagement.tsx`.
    - Removed obsolete `backend-core/tests/integrity-risk-score.test.cjs`.
- **Preserved Core Security**:
  - Preserved standard core quiz violation logs (`TAB_SWITCH`, `WINDOW_BLUR`, `FULLSCREEN_EXIT`, `BLOCKED_KEY`, `CLIPBOARD`, and keyboard shortcut sequence recording in `useSecureExam.ts` & `recordViolation`).
  - Preserved 30-second rotating classroom OTP gate, single-session device lock, question rendering, deterministic option shuffling, grading, and submission flow.
- **Validation**:
  - `backend-core`: `npm run build` passed (`tsc` 0 errors); all 11 test suites passed (39 tests, 0 failures).
  - `frontend-web`: `npm run build` passed (`tsc -b && vite build` 0 errors); all 26 test suites passed (98 tests, 0 failures).

## Follow-up: Offline / External Quiz Marksheet Import & Topic-Wise Analytics (2026-11-18)

- **Objective**:
  - Implement a full-featured marksheet import system for offline/external quizzes conducted outside the platform while preserving topic-wise student performance reports.
- **Features Implemented**:
  - **Two-Mode Offline Marksheet Import Flow (Faculty Quizzes Dashboard)**:
    - Added "Import External Marksheet" modal with two modes:
      - **Mode A (Question-Wise / Topic-Mapped Import)**: Lightweight question blueprint (`Q# | Topic Tag | Max Marks`) with dynamic table + quick paste question paper text parser; downloadable custom CSV/XLSX template; spreadsheet upload (.xlsx/.csv) or live interactive table with real-time scoring, validation status badges, and publish toggle. Creates lightweight question stubs (`NUMERICAL`, topic, marks) and responses feeding directly into the existing topic analytics engine.
      - **Mode B (Total-Score-Only Import)**: Rapid marks entry with title, max marks, and overall topic tags. Uploads/enters student roll number/email and total score. Automatically sets `hasQuestionBreakdown: false`.
  - **Backend Schema & Analytics Compatibility**:
    - Extended Prisma schema with `enum QuizSourceType { ONLINE OFFLINE }`, added `sourceType` and `hasQuestionBreakdown` to `Quiz`, and `sourceType` to `QuizAttempt`.
    - Added atomic transaction `importOfflineMarksheet` and `validateOfflineMarksheet` with server-side roster verification and scope enforcement.
    - Zero proctoring violation overhead or behavioral tracking for offline attempts; attempts marked `EVALUATED`.
    - Enforced guards in `startExam` and `getQuizInstructions` to prevent students from starting offline quizzes as online exams.
  - **Student & Faculty Analytics & Report UI Integration**:
    - Quizzes table and Submissions view badge external quizzes as "Offline / External Quiz" and replace live OTP card with informational offline assessment banner.
    - In Student Reports, Mode A scores feed directly into student's topic-wise accuracy/strength calculation alongside online quizzes; Mode B quizzes display clean notice (`"Overall score imported (no per-question topic breakdown)"`) instead of blank charts.
    - Student dashboard and exam results view clearly display "Offline / External Quiz" badge, total score, and graceful Mode B fallback.
- **Validation**:
  - Added `backend-core/tests/offline-marksheet.test.cjs` covering column header aliases, student matching, validation, atomic database transaction, analytics projection, and online-attempt prevention.
  - Added `frontend-web/src/lib/csv.test.ts` for CSV parsing and download tests.
  - `backend-core`: All 12 test suites passed (45 tests, 0 failures).
  - `frontend-web`: All 26 test suites passed (100 tests, 0 failures).
  - Production builds (`npm run build` in both `backend-core` and `frontend-web`) completed with 0 errors.

## Follow-up: Offline Marksheet Import Reliability & Wizard UI Overhaul (2026-11-18)

- **Objective**:
  - Resolve backend 500 errors (`ERR_FEATURE_UNAVAILABLE` & `ERR_INTERNAL_SERVER`), enforce mandatory class scoping, redesign modal layout into a spacious 2-step wizard, fix sticky header CSS overlap, and provide a prompt copy tool for faculty.
- **Issues Resolved & Features Added**:
  - **Prisma Schema Sync & 500 Error Resolution**:
    - Ran non-destructive `npx prisma db push` to synchronize `QuizSourceType`, `Quiz.sourceType`, `Quiz.hasQuestionBreakdown`, and `QuizAttempt.sourceType` with the PostgreSQL database.
    - Resolved `P2022` column missing error that was being intercepted and mapped to `ERR_FEATURE_UNAVAILABLE` (HTTP 500) by the error middleware.
  - **Transaction Performance & Structured Validation (`offline-quiz.controller.ts`)**:
    - Replaced slow sequential `for` loop database writes with batched `createMany` queries for questions, quiz attempts, and quiz responses with `skipDuplicates: true`. Reduces transaction time from >30s (causing P2028 transaction timeout / `ERR_INTERNAL_SERVER`) to <100ms for 50+ students.
    - Added structured detection and clean HTTP 400 `ERR_VALIDATION_FAILED` responses with detailed lists of unmatched or duplicate student identifiers rather than crashing the database transaction with 500.
  - **Mandatory Target Class Selection**:
    - Removed `"All Assigned Classes"` default; required faculty to explicitly choose a target class or section before proceeding to mark entry or import.
    - Added inline validation error styling and frontend disable states, backed by strict backend validation (`ERR_MISSING_TARGET_CLASS`).
    - Added fallback class fetching from `/api/v1/faculty/quiz/question-papers/classes` when props are unpopulated.
  - **Spacious 2-Step Wizard UI (`OfflineMarksheetModal.tsx`)**:
    - Replaced congested stacked layout with a clean, spacious 2-step wizard (`max-w-6xl w-[95vw]`):
      - **Step 1: Quiz & Topic Blueprint**: Side-by-side cards for quiz settings, mandatory class selector, marks configuration, and blueprint setup.
      - **Step 2: Upload / Verify Student Marks**: Clean action toolbar, download template, spreadsheet upload, filter tabs (`All`, `Valid`, `Issues`), and summary verification strip.
    - Fixed sticky table header CSS (`bg-slate-100 dark:bg-neutral-800 z-10 sticky top-0`) to eliminate header text overlapping with table rows during scroll.
    - Integrated `<datalist id="suggested-topics-list">` for smooth autocomplete of topic tags.
  - **"Copy AI Prompt" Button**:
    - Added a 1-click "Copy AI Prompt" button in Step 1 next to "Paste Blueprint" that copies the exact formatting prompt to clipboard with visual "Copied!" feedback and toast notification.
- **Validation**:
  - `backend-core`: Added tests in `backend-core/tests/offline-marksheet.test.cjs` for mandatory class selection and unmatched student 400 rejection; all 12 test suites passed (47 tests, 0 failures).
  - `frontend-web`: `tsc -b && vite build` completed with 0 errors; all 26 Jest test suites passed (100 tests, 0 failures).

## Follow-up: Removal of Admin Hub & Consolidation into Faculty Management (2026-11-22)

- **Objective**:
  - Remove standalone Admin Hub and dedicated `/admin` routes.
  - Consolidate all administration capabilities (Faculty Approvals, User Management, Student Bulk Import, Batches, Departments, and Sections) directly into the Faculty Management module under horizontal sub-tabs.
  - Update backend role guards so both `FACULTY` and `ADMIN` roles seamlessly access management routes without 403 errors.
- **Removed Admin Hub Files & Navigation**:
  - Deleted `frontend-web/src/pages/AdminDashboard.tsx`.
  - Removed Admin Hub routes (`/admin/dashboard`) from `App.tsx` and redirected all `/admin` and `/admin/*` traffic directly to `/faculty/dashboard?tab=management`.
  - Removed legacy Admin Hub navigation items from `DashboardLayout.tsx`.
- **Merged Faculty Management Module**:
  - Created `frontend-web/src/components/dashboard/FacultyManagement.tsx`:
    - Top summary stats: Total Faculty, Pending Approvals, Registered Users, Academic Batches.
    - Clean horizontal sub-tabs:
      - **Faculty Approvals**: Searchable list with quick filter chips (`All`, `Pending`, `Approved`, `Rejected`), employee IDs, approval/revoke actions with inline loading.
      - **User Directory & Student Import**: Bulk CSV/XLSX enrollment with template download & structured rejection diagnostics; user accounts table with role filter and permanent delete action via `DeleteConfirmationDialog`.
      - **Departments & Sections**: Batch list selector, department creation, department delete, and interactive section creation panel.
  - Added "Faculty Management" under the "Administration" group in `FacultyDashboard.tsx` (`tab=management` and alias `tab=admin`).
  - Updated `ProtectedRoute.tsx` and `Login.tsx` to route `ADMIN` and `FACULTY` accounts to the unified workspace.
- **Backend Role Guard Updates**:
  - `backend-core/src/routes/admin.routes.ts`: Updated to `authorize(['ADMIN', 'FACULTY'])`.
  - `backend-core/src/routes/department.routes.ts`: Updated to `authorize(['ADMIN', 'FACULTY'])`.
  - `backend-core/src/routes/faculty-reports.routes.ts`: Updated to `authorize(['FACULTY', 'ADMIN'])`.
- **Validation**:
  - `backend-core`: All 18 test suites passed (85 tests, 0 failures).
  - `frontend-web`: `tsc -b && vite build` succeeded with 0 errors; all 26 test suites passed (101 tests, 0 failures).

## Follow-up: Refactor Administration into 3 Dedicated Separate Dashboards (2026-11-22)

- **Objective**:
  - Unstack congested single-page administration layout into 3 separate, clean, independent dashboards matching original design:
    1. **Faculty Approval** (`tab=approvals`): Dedicated view for reviewing pending/approved faculty registrations with status filters and approve/reject/revoke actions.
    2. **Student / User Directory** (`tab=users`): Dedicated view with Year/Batch, Department, and Section dropdown filters, role filtering, clickable student profiles (`StudentProfileView`), password reset, account deletion, and bulk student CSV/XLSX import.
    3. **Batches, Departments & Sections** (`tab=departments`): Dedicated 3-column academic structure view with batch selector, inline department creation, and interactive section management.
- **Frontend & Navigation Refactoring**:
  - `frontend-web/src/pages/FacultyDashboard.tsx`:
    - Updated `facultyNavigation` under `Administration` to offer direct tabs: `Faculty Approval` (`approvals`), `Student / User Directory` (`users`), and `Batches & Departments` (`departments`), alongside `Faculty Management` (`management`).
    - Added dedicated tab rendering and header titles for each view.
  - `frontend-web/src/components/DashboardLayout.tsx`:
    - Added fallback admin and faculty navigation buttons for the three individual administrative modules.
  - `frontend-web/src/components/dashboard/FacultyManagement.tsx`:
    - Refactored into 3 independent, uncluttered dashboard views each with its own header, metric cards, actions, and filter bar.
    - Integrated `StudentProfileView` modal for clickable student profile inspection.
    - Added clean top-level horizontal navigation pills with pending counters to switch seamlessly between views without clutter.
- **Backend Enhancements**:
  - `backend-core/src/controllers/admin.controller.ts`:
    - Enriched `getAllUsers` and `getAllFaculty` to select `rollNumber`, `employeeId`, `department` (with batch details), and `section` for complete directory filtering.
- **Validation**:
  - `backend-core`: `npm run build` (`tsc`) succeeded; all 18 test suites passed (85 tests, 0 failures).
  - `frontend-web`: `npm run build` (`tsc -b && vite build`) succeeded with 0 errors; all 26 Jest test suites passed (103 tests, 0 failures).







