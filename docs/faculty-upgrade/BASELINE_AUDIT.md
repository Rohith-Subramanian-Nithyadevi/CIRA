# Faculty Upgrade Baseline Audit

## Scope and limits

This audit is based on the current source tree on `santhosh_branch` and SPEC sections 2, 4.2–4.4, 22 and 23. No application code was changed and no tests were run. SPEC section 2 documents an AI service under `backend-ai`; its directory contains only Python bytecode caches and no inspectable `.py` source, so AI/service-token behavior could not be fully verified.

## Repository status at start

- Branch: `santhosh_branch` (ahead of `origin/santhosh_branch` by 1 commit).
- Modified tracked file: `.vscode/settings.json`.
- Pre-existing untracked paths: `CIRA/`, `backend-core/fix_faculty.js`, `backend-core/scratch_get_student.ts`, `backend-core/seed_new_quizzes.js`, `backend-core/seed_reports.ts`, `backend-core/update_passwords.ts`, `docs/faculty-frontend-transformation/`, `docs/faculty-frontend-upgrade/`, and `docs/faculty-upgrade/`.
- These files were not modified or staged by this audit. The three requested audit docs are new within the already-untracked `docs/faculty-upgrade/` tree.

## Architecture overview

- Frontend: React 19 + TypeScript + Vite, with `react-router-dom`, Firebase client auth, and a shared fetch wrapper in `frontend-web/src/lib/apiClient.ts`.
- API: Express 5 + TypeScript. `backend-core/src/app.ts` mounts versioned route modules under `/api/v1`; controllers call Prisma directly in most areas.
- Primary persistence: PostgreSQL through Prisma Client (`backend-core/prisma/schema.prisma`). No Prisma migrations directory was present under `backend-core/prisma` at audit time.
- Additional persistence: Mongoose `QuestionBank` model in `backend-core/src/models/QuestionBank.ts`; the app has a MongoDB configuration (`backend-core/src/config/db.ts`) in addition to Prisma. Question-bank import uses this Mongoose model. The SPEC also documents a FastAPI/Python/MongoDB AI service in `backend-ai`, but the checked-in directory currently contains only `__pycache__/*.pyc` files under `src` and no readable source, dependency manifest or route implementation.
- External services/libraries: Firebase Auth (Google sign-in and server token verification), email via `backend-core/src/utils/email.ts`, and Cloudinary for uploaded images.
- Middleware: bearer JWT authentication and role middleware in `backend-core/src/middlewares/auth.middleware.ts`; Multer upload middleware in `backend-core/src/middlewares/upload.middleware.ts` plus route-specific Multer configurations.

## Faculty, department, batch, section and student relations

`Batch` has many `Department`; each `Department` has one required `batchId` and many `Section`. `User` has optional single `departmentId` and `sectionId` fields (used by student records), while faculty scope is represented by many-to-many join models `FacultyDepartment` and `FacultySection`, each keyed by `(userId, departmentId)` or `(userId, sectionId)`. Faculty-to-batch scope is indirect through mapped departments/sections; there is no direct faculty-to-batch mapping. Thus a faculty account can be mapped to multiple departments and multiple sections, including sections from different department/batch records, subject to API integrity checks (which are not consistently present). A student has one optional department and one optional section field; section-to-department consistency is not enforced by a compound FK in the schema.

Relevant files: `backend-core/prisma/schema.prisma` (`Batch`, `Department`, `Section`, `User`, `FacultyDepartment`, `FacultySection`); `backend-core/src/controllers/faculty.controller.ts` enrollment and student-query handlers; `backend-core/src/routes/faculty.routes.ts`.

## Questions, quizzes and question-paper usage

Prisma enum `QuestionType` includes `MCQ`, `MULTI_SELECT`, `NUMERICAL`, `SHORT_WRITTEN`, `LONG_WRITTEN`, `MATCHING`, `TRUE_FALSE`, `FILL_BLANK`, and `CODING`. Prisma `Question` is quiz-owned by required `quizId`; it stores type, text, optional legacy `topic` and optional `topicId`/Topic relation, marks, negative marks, JSON options and answer key, optional explanation and image, and relations to quiz responses. There is no dedicated question-paper model, versioned paper model, or explicit question-bank usage/join relation in the Prisma schema. A `Quiz` owns `Question[]`; quiz attempts reference the quiz and responses reference questions. The distinct Mongo `QuestionBank` is spreadsheet-import-oriented and stores `question_type`, topic/subtopics, difficulty, content, options, correct option and metadata tags; no usage relation to Prisma quiz questions was found.

Relevant files: `backend-core/prisma/schema.prisma` (`QuestionType`, `Quiz`, `Question`, `QuizAttempt`, `QuizResponse`); `backend-core/src/models/QuestionBank.ts`; `backend-core/src/controllers/exam.controller.ts`; `backend-core/src/controllers/quiz.controller.ts`.

## Surveys, announcements and notifications

Prisma has `Announcement` with `isSurvey` boolean and a free-text `audience`, linked to its author via `facultyId`; `AnnouncementResponse` stores one string response per `(announcementId,userId)`; and faculty `Notification` stores a string type/message, read flag and `facultyId`. Student notifications are a separate `StudentNotification` model with enum type, title/message, priority/read and user relation. No first-class poll/survey question/options model was found.

Faculty routes (mounted at `/api/v1/faculty/dashboard`): task and calendar CRUD, `GET/POST /announcements`, `DELETE /announcements/:id`, `GET /announcements/:id/responses`, `GET /notifications`, and `PATCH /notifications/:id/read`. Student routes (mounted at `/api/v1/student`): `GET /announcements`, `POST /announcements/respond`, `GET /improvement/notifications`, and `PATCH /improvement/notifications/:id/read` (improvement router mounted at `/api/v1/student/improvement`). Route auth is bearer JWT; the faculty dashboard router authenticates but does not call `authorize(['FACULTY'])` at the router level. Handlers scope most faculty-owned rows to token user ID. Student announcement visibility/target behavior and audience encoding need deliberate review because the schema stores `audience` as a string rather than relational targets.

Relevant files: `backend-core/prisma/schema.prisma`; `backend-core/src/routes/faculty-dashboard.routes.ts`, `student-dashboard.routes.ts`, `student-improvement.routes.ts`; `backend-core/src/controllers/faculty-dashboard.controller.ts`, `student-dashboard.controller.ts`, `student.controller.ts`, `student-improvement.controller.ts`.

## Authentication, reset and faculty onboarding

Two sign-in paths exist: email/password using `bcryptjs`, then app-issued JWT bearer tokens; and Firebase Google sign-in where the backend verifies the Firebase ID token with Firebase Admin before issuing its own JWT. `frontend-web/src/lib/firebase.ts` configures the client Firebase app. JWT payload contains `userId` and `role`, with expiration from `JWT_EXPIRES_IN` (default `1d`) and a required `JWT_SECRET`.

Registration endpoints are `/api/v1/auth/register` and `/firebase-register`; email verification is `/verify-email`. Both set faculty to `PENDING`, students to `APPROVED`, and require a verification code before normal sign-in; admin approval is through `PUT /api/v1/admin/faculty/:facultyId/approve`. Password reset uses public `/forgot-password` and `/reset-password`, sends a 6-digit code to the stored personal email and stores it in the same `User.verificationCode`/expiry fields used for verification. Google-account password reset is rejected. No dedicated reset-token table or password-reset model is present.

Relevant files: `backend-core/src/controllers/auth.controller.ts`, `backend-core/src/routes/auth.routes.ts`, `backend-core/src/config/firebase.ts`, `backend-core/src/utils/jwt.ts`, `backend-core/src/middlewares/auth.middleware.ts`, `backend-core/src/controllers/admin.controller.ts`, `backend-core/src/routes/admin.routes.ts`, `frontend-web/src/pages/Login.tsx`.

## Assessment submission authorization and service / AI paths

`/api/v1/student/exam/*` applies `authenticate` and `authorize(['STUDENT'])`. Start uses token `userId` for attempt lookup/creation but, after loading a quiz by `quizId`, does not repeat the eligibility target check performed by `GET /eligible`. `saveResponse` and `submitExam` load the attempt by path ID and compare its `userId` to token `userId`; save also verifies that the submitted question belongs to the attempt's quiz. Results are scoped to current user. This is a useful ownership check, but the unrestricted-by-target start path is a significant authorization gap to resolve.

Faculty quiz routes require FACULTY or ADMIN. Quiz create/update/delete and evaluation handlers generally check creator ownership (ADMIN exception); `allowRestart` checks ADMIN or quiz creator. `evaluateStudent` on `/api/v1/faculty/evaluate` checks a faculty mapping against the target student's department or section. Assignment routes use `authenticate` at router level and controller ownership checks for faculty-owned data; role validation and target ID validation vary by handler and require endpoint-level regression review. Legacy `/api/v1/exams/questions/import` uses authenticated FACULTY/ADMIN and imports into Mongo QuestionBank.

No service-token middleware, machine-token route, or AI provider/client integration was found in `backend-core/src` or `frontend-web/src`. `analytics.service.ts` documents deterministic, non-AI logic. This is a source search finding, not proof that external infrastructure has no such credentials or integration.

Relevant files: `backend-core/src/routes/student-exam.routes.ts`, `backend-core/src/controllers/student-exam.controller.ts`, `backend-core/src/routes/quiz.routes.ts`, `backend-core/src/controllers/quiz.controller.ts`, `backend-core/src/controllers/faculty.controller.ts`, `backend-core/src/routes/assignment.routes.ts`, `backend-core/src/controllers/assignment.controller.ts`, `backend-core/src/services/analytics.service.ts`.

## Upload and PDF / print mechanisms

- Student spreadsheet question import: memory-storage Multer, Excel MIME allowlist, 10 MB limit, `POST /api/v1/exams/questions/import` (`backend-core/src/middlewares/upload.middleware.ts`, `exam.routes.ts`, `exam.controller.ts`).
- Student bulk import: route-specific memory Multer with 5 MB cap, `POST /api/v1/admin/students/import`; controller parses spreadsheet rows (`admin.routes.ts`, `admin.controller.ts`).
- Quiz DOCX/image upload: route-specific disk Multer to `uploads/`, max 10 MB, extension allowlist; parser uses DOCX and extracted images are sent to Cloudinary. Image upload handler uploads temporary file to Cloudinary (`quiz.routes.ts`, `quiz.controller.ts`, `utils/cloudinary.ts`).
- DOCX quiz template generation: `docx` package creates a downloadable `Quiz_Template.docx` (`template.controller.ts`).
- In `backend-core`, no server-side PDF renderer/export endpoint was found. Browser print uses `window.print()` and CSS print rules in `frontend-web/src/index.css`, with print buttons in reports/profile/submission views. A `GeneratedAssignment` Mongoose model has a `pdf_url` field but no active PDF generation route was identified in the inspected route tree. `backend-ai/src/utils/__pycache__/pdf_generator.cpython-314.pyc` exists, but its missing Python source prevents verification of whether it is an active PDF path or how it is exposed.

## Test frameworks and scripts

- `frontend-web/package.json`: `npm test` runs Jest (`jest --watchAll=false --runInBand`); `npm run test:watch` runs Jest watch; tests use `jest-environment-jsdom`, Babel transforms and Testing Library. `npm run build` runs `tsc -b && vite build`; `npm run lint` runs oxlint.
- `backend-core/package.json`: `npm test` intentionally exits 1 with “Error: no test specified”; no test framework or test script is configured. `npm run build` runs `tsc`. Files named `test_*.ts` and scratch checks exist at the backend root but are not wired into a runner.
- Root `package.json` contains no scripts (dependencies only); this audit does not run tests/builds.

## Initial technical risks / spec mismatches to resolve

1. The spec is empty, so all acceptance criteria and exact phase names/sections are unknown; do not infer them from task labels alone.
2. Prisma migrations are absent from the inspected `backend-core/prisma` tree. Before schema changes, identify the repository's deployed migration workflow and reconcile the schema baseline.
3. Two persistence stacks exist: Prisma/PostgreSQL and Mongoose/MongoDB. New question-bank functionality must specify the source of truth and cross-store semantics.
4. Student exam start can create/resume an attempt for an arbitrary known quiz ID without rechecking the student's target eligibility.
5. `Question.answerKey` is persisted alongside student-facing question data; current `startExam` explicitly excludes answerKey, but quiz-detail/other response serializers need review to prevent leakage.
6. Faculty dashboard routes authenticate but omit an explicit FACULTY/ADMIN role guard; handlers derive ownership from `req.user`, but authenticated students can reach those routes unless handler checks prevent unwanted behavior.
7. Faculty enrollment APIs accept department/section IDs from request data and directly create mappings. Server-side authorization for an authenticated faculty user is present, but batch/department/section relationship and permission constraints need stronger server validation.
8. Assignment routes only apply authentication globally, not role authorization. Confirm every handler enforces role, record ownership, student target scope and IDs server-side.
9. Password-reset OTP uses shared verification fields; there is no explicit attempt limit or rate limiter in the inspected auth router, and password reset does not validate password length as strictly as registration.
10. Multer quiz uploads use disk temp storage; ensure temporary files are deleted on all error paths and the upload directory is excluded from public/static serving. Extensions are checked, while content-type and content-signature validation need scrutiny.
11. Faculty/student association is split between single User department/section fields and faculty mapping joins; requirements assuming a direct faculty-batch model do not match this schema.
12. Announcement audience is free text and has no normalized audience relation; requirements for reliable class targeting, targeting multiple cohorts, or poll options need schema/API design.
13. There is no dedicated question-paper/version model or question-to-bank usage relation; paper workflow requirements cannot be met by an assumed existing abstraction.
14. The SPEC documents a FastAPI AI service and MongoDB, but the repository's `backend-ai` directory has only `.pyc` cache artifacts, with no source files to inspect or modify. Any service-identity assessment-submission policy must be verified against the actual deployed service/source before claiming coverage.
15. No backend automated test runner is configured; regression coverage must be introduced or validated by another approved method in a later task.

## Final QA addendum (2026-11-09)

This file records the original pre-implementation baseline; its findings above are historical and should not be read as current-state assertions. Current implementation and verification status is summarized in [FINAL_REPORT.md](FINAL_REPORT.md), with phase status in [IMPLEMENTATION_TRACKER.md](IMPLEMENTATION_TRACKER.md).

- The current backend now has a Node built-in test suite wired to `npm test`; the baseline note that no runner was configured is no longer current.
- Additive Prisma migrations and API changes for the question bank, papers and polls are documented in `API_AND_DATA_DEPENDENCIES.md`. They were not applied to a live database during final QA.
- Final QA ran builds, typechecks and automated suites, but did not run a live API/database integration, populated browser workflow, or actual PDF print/export session. The missing `backend-ai` Python source remains a limitation.

