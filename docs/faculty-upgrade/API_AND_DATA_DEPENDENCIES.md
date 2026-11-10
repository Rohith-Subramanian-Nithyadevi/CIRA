# API and Data Dependencies

> Baseline inventory from source inspection against SPEC sections 2 and 4.2–4.4. The documented `backend-ai` service has no inspectable Python source in the checkout.

## API mounts

`backend-core/src/app.ts` mounts Express routers at `/api/v1`:

| Mount | Main routes / behavior | Persistence and relevant files |
|---|---|---|
| `/auth` | register/login/email verify/password reset/Firebase login and registration/`me` | Prisma `User`; auth controller, auth routes, Firebase config, JWT utils |
| `/faculty` | profile, student evaluation, enrollments, student search/list/profile | Prisma `User`, `FacultyDepartment`, `FacultySection`, `Result`; faculty controller/routes |
| `/faculty/quiz` | quiz CRUD, questions, submissions/evaluation, restart, publishing, DOCX/image upload, template download | Prisma `Quiz`, `Question`, `QuizAttempt`, `QuizResponse`; quiz/template controllers |
| `/faculty/reports` | performance bands and quiz analytics | Prisma quiz/attempt/user joins; faculty reports controller |
| `/faculty/dashboard` | faculty tasks, calendar, announcements/survey response listing, faculty notifications | Prisma `Task`, `CalendarEvent`, `Announcement`, `AnnouncementResponse`, `Notification` |
| `/assignments` | faculty assignment management/submissions/grading and student assignment listing/submission | Prisma `Assignment*`, `AssignmentSubmission` |
| `/student/exam` | eligible quizzes, start, response autosave, submit, result | Prisma `Quiz`, `Question`, `QuizAttempt`, `QuizResponse` |
| `/student` | dashboard/profile/announcements/respond and student tasks/calendar/resources/analytics | Prisma `User`, `Announcement*`, student activity models |
| `/student/improvement` | SIS, insights, mistakes, goals, achievements, student notifications/resources | Prisma improvement models and deterministic analytics service |
| `/admin` | faculty approval, user management, student import | Prisma `User`, `Department`, `Section` |
| `/exams` | Excel question-bank import | Mongoose `QuestionBank` |
| `/analytics`, `/departments`, `/batches` | analytics and organization reference/management routes | Prisma data models |

The SPEC additionally describes `backend-ai` as FastAPI/Python/MongoDB. The checkout contains only `backend-ai/src/**/__pycache__/*.pyc`; no Python route, dependency manifest, app entry point or source contracts are available to inventory. The bytecode names include analytics, assignment, department, NLP, topic-matcher and weak-topic modules, plus a PDF generator helper. Their behavior, authentication and active deployment status cannot be verified from this source tree.

## Important data relationships

- Org: `Batch -> Department -> Section`; `User.departmentId`/`sectionId` are nullable scalar relations. Faculty scope uses join tables `FacultyDepartment`/`FacultySection`.
- Quizzes: `Quiz -> Question[]`, `Quiz -> QuizAttempt[]`; quiz targets are join tables `QuizDepartment`, `QuizSection`, `QuizStudent`. Attempts belong to one user and quiz; `QuizResponse` unique key is `(attemptId, questionId)`.
- Assignments: one assignment can target batches/departments/sections/students by separate join tables; submissions relate to user and assignment.
- Announcements: faculty author relation; free-text audience and `isSurvey`; responses unique per announcement/user. No normalized class targeting or survey options model.
- Notifications: faculty `Notification` and student `StudentNotification` are separate schemas.
- Question bank: separate Mongoose document model, not relationally connected to Prisma questions.

## Authentication and request identity

`authenticate` parses `Authorization: Bearer <app JWT>` and exposes `req.user.userId` and `role`; `authorize` enforces role where route modules use it. Firebase ID tokens are only consumed on the Firebase auth endpoints, verified server-side, then exchanged for app JWTs. Controllers should derive actor identity from `req.user`, never from request-supplied user/faculty IDs.

Security foundation additions: both faculty registration endpoints normalize and enforce the exact `@ch.amrita.edu` domain; the reusable `attachFacultyScope` middleware derives the faculty ID from `req.user.userId` and attaches mapped classes and student IDs in `req.facultyScope`; student exam submission checks a STUDENT principal and attempt owner; faculty profile PUT accepts only `currentPassword` and `newPassword` for email/password accounts. The existing `/api/v1/faculty/profile` endpoint remains the password-change API. Google-auth faculty are directed to their external account password management because the User model has no Firebase UID or supported password-update mapping.

## Upload and output integrations

- Multer memory uploads: Excel import; admin bulk student import.
- Multer disk upload: quiz DOCX/image input under `uploads/`; images uploaded to Cloudinary.
- DOCX template generation: `docx` package.
- PDF generation: no inspectable PDF endpoint in `backend-core`; browser print via `window.print()` and `@media print` CSS exists. A compiled `backend-ai` PDF-generator helper exists without source or route wiring available for inspection.

## Dependencies / change sequencing

1. Establish exact SPEC contracts and target test commands before implementation.
2. Security changes should account for route-level guards and controller ownership on quiz, assignment, announcement and attempt routes.
3. Student scoping changes depend on the current organization model: student scope is one department/section; faculty may have many mapped departments/sections; batch scope is derived.
4. Question Bank and paper work must choose PostgreSQL/Prisma or MongoDB/Mongoose as source of truth and define a durable usage/provenance relation.
5. Poll work depends on replacing/expanding the announcement `isSurvey` + free-text response mechanism with structured questions/options if required.
6. Notification work needs to identify event producers as well as the faculty/student-specific models and ownership rules.
7. Additive migrations are the only schema migration approach allowed by `AGENTS.md`; currently there is no checked-in Prisma migrations directory in `backend-core/prisma`.
8. The AI/service identity restrictions cannot be fully audited or enforced in the missing `backend-ai` source; only core API paths were inspectable.


## Task 2 student scope and reset contracts

All faculty routes attach `attachFacultyScope` using the authenticated app JWT. `buildFacultyStudentWhere` injects the mapped student ID set before client filters, and an empty/missing scope fails closed. Query parameters may narrow the set but cannot expand it.

| Endpoint | Contract | Authorization / data handling |
|---|---|---|
| `GET /api/v1/faculty/students/filter-options?year=&departmentId=` | `{ data: { years: number[], departments: [{id,name,batchId,startYear}], sections: [{id,name,departmentId}] } }` | Authenticated Faculty/Admin; each option query is derived from scoped student records. Year narrows departments; year + department narrow sections. |
| `GET /api/v1/faculty/students?page=&limit=&year=&departmentId=&sectionId=&search=` | `{ data: { students: [{id,name,rollNumber,department,departmentId,year,section,sectionId}], pagination } }` | Authenticated Faculty/Admin; paginated, server-scoped before count and row lookup. Admin retains all-student access. |
| `GET /api/v1/faculty/students/search?rollNumber=&year=&departmentId=&sectionId=` | Existing profile/search payload | Scope is combined with roll-number match before querying. Out-of-scope students are not returned. |
| `GET /api/v1/faculty/students/:studentId/profile` | Existing student profile/report payload | Scope and requested student ID are combined in the database lookup before dependent attempt data is loaded. |
| `GET /api/v1/faculty/reports/performance-bands?year=&batchId=&departmentId=&sectionId=` | Existing performance summary | Reports router is Faculty-only; authorized student set is queried before quiz-attempt aggregation. |
| `GET /api/v1/faculty/reports/quiz/:quizId?year=&departmentId=&sectionId=` | Existing summary, leaderboard, topic averages and section comparison | Authorized student filter is nested into the attempt query before aggregation; quiz audience is intersected with it. |
| `POST /api/v1/faculty/students/:studentId/reset-password` | `{ status: "success", message }` | Faculty-only. Server checks target is a STUDENT inside token-derived scope; returns 404 for out-of-scope. Uses the existing OTP email reset lifecycle; no password/OTP is returned. Google SSO accounts are directed to Google. |

Year is represented by `Department.batch.startYear` in this repository. There is no audit-log model/service available for password-reset initiation. No Prisma migration was needed.

## Task 3 Question Bank contracts

Question bank endpoints are mounted under `/api/v1/faculty/quiz` and inherit its authenticated FACULTY/ADMIN role gate:

| Endpoint | Contract |
|---|---|
| `GET /question-bank?category=&search=&subject=&topic=&difficulty=&type=&tag=&includeReused=&page=&limit=` | Paginated `{ data: { items, pagination } }`; an item includes the existing Question fields, `owner`, `usages`, `ownership`, and `reuse` eligibility/warning. Faculty see their own questions plus shared legacy/admin questions; Admin sees all. Opposite-category usage is excluded unless `includeReused=true`. |
| `POST /question-bank` | Creates a question with category, type, text, subject/topic/subtopic, difficulty, tags, marks, options, answer, explanation, and optional uploaded image URL. The owner always comes from the JWT. |
| `PUT /question-bank/:questionId` | Updates a question only when owned by the caller (Admin exception). |
| `DELETE /question-bank/:questionId` | Archives an owned bank question; assessment response history remains intact. |
| `POST /question-bank/upload-image` | Multipart `file`; PNG/JPEG/WebP, maximum 5 MB. Authenticated upload streams to the existing Cloudinary folder and returns `{ data: { url } }`. |

The additive Prisma migration makes legacy `Question.quizId` nullable, assigns ownership from its quiz creator when that creator exists, copies the existing quiz subject, and backfills TEST_QUIZ usage rows. Deleting a Quiz now sets its Question and QuestionUsage quiz references to null, preserving the bank question and usage snapshot. The `QuestionUsage` model supports Quiz and Assignment references with assessment title/category snapshots so usage history remains after assessment deletion.

The existing `Question.image` field is reused. `createdAt`, archive state, owner, question category, subject, subtopic, difficulty, tags, and the usage relation are added only where missing. The unlinked Mongoose import collection is unchanged because it has no management/read API or ownership/usage contract in the current frontend.

## Task 4 Question Paper contracts

Question papers are persisted as Quiz records to keep the existing student attempt, response, grading, and submission views. `paperCategory` distinguishes Assignment from Test/Quiz; `paperStatus` uses DRAFT, READY, PUBLISHED, CLOSED. Legacy quizzes default to PUBLISHED after migration. Selected bank questions are stored in `QuestionUsage` with ordering, per-paper marks, explicit reuse flag, and finalized state. Paper marks never overwrite bank marks.

| Endpoint | Contract |
|---|---|
| `GET /api/v1/faculty/quiz/question-papers/classes` | Returns only department/section classes authorized by token-derived faculty scope. |
| `GET /api/v1/faculty/quiz/question-papers` | Lists caller-owned papers (Admin may list all), status, class, selected questions and totals. |
| `POST /api/v1/faculty/quiz/question-papers` | Creates a DRAFT paper for category/title/subject/instructions/schedule. |
| `GET /api/v1/faculty/quiz/question-papers/:paperId` / `PUT ...` | Read or edit owned draft/ready papers; PUT persists exact question IDs and per-paper marks, and requires explicit `includeReused` for opposite-category use. |
| `POST .../:paperId/generate` | Randomly selects unique eligible bank questions with count/subject/topic/difficulty; `confirmReplace: true` required to replace an existing selection. |
| `POST .../:paperId/publish` / `POST .../:paperId/close` | Publishes idempotently after server-side class scope validation, finalizes usage rows; close transitions published paper to closed. |

Published paper Quiz records target a single authorized department or section and are delivered by the existing student exam APIs. The student start path checks publication and the authenticated student's target; bank questions in a paper are included with usage marks, while answer keys remain absent from the exam-start response. Student responses and grading stay on existing QuizAttempt/QuizResponse tables. Existing `/api/v1/faculty/quiz/:quizId/submissions` is surfaced through QuizManagement from the paper list.

## Task 5 Poll contracts

Polls extend `Announcement` (`isPoll`, `pollOptions`, `pollStartsAt`, `pollExpiresAt`, and structured `pollAudienceType` / `pollTargetId`) and reuse the unique `AnnouncementResponse` per announcement/student relation. Existing free-text surveys remain unchanged. Faculty poll endpoints live under `/api/v1/faculty/dashboard/announcements/polls`:

| Endpoint | Contract |
|---|---|
| `GET /polls/targets` | Lists only authorized batches, departments and sections from JWT-derived faculty scope. Batch targeting is offered only if every department in that batch is assigned to the faculty member. |
| `GET /polls?status=ALL\|PUBLISHED\|ACTIVE\|CLOSED` | Lists only the caller's polls; Admin may list all. Includes response counts. |
| `POST /polls` | Validates question/options/dates and validates target membership server-side before saving the Announcement poll. |
| `GET /polls/:id/results` | Owner-only aggregate option counts and percentages; percentages are null when response count is zero. |

Students receive polls from the existing `/api/v1/student/announcements` route, filtered by structured audience IDs. Existing `POST /api/v1/student/announcements/respond` accepts one of the stored options and creates one immutable response; duplicate polls votes return conflict. The existing free-text survey path still upserts its response.

## Task 6 Notifications

The existing Prisma `Notification` model and faculty routes were verified and reused; no second notification model or API was added. `GET /api/v1/faculty/dashboard/notifications` returns the authenticated faculty user's latest 50 notifications. `PATCH /api/v1/faculty/dashboard/notifications/:id/read` persists an individual read state after confirming the notification belongs to that user. Both routes now require Faculty/Admin role. There is no bulk mark-read endpoint, so the UI does not offer mark-all-read.

The global workspace header bell and Notifications page share one client provider and the existing API. The provider refreshes at the existing 30-second cadence. Notification titles/categories/icons and workflow destinations are derived from the existing `type` string; the existing model has no separate title, description, or destination columns.

## Final QA and deployment status (2026-11-09)

- Current schema and endpoint implementation are described above. Final QA verified compilation and automated tests but did not connect to PostgreSQL, apply Prisma migrations, start the API against a database, or exercise real persisted requests. Migration application and operational rollout therefore remain unverified.
- `frontend-web` and `backend-core` build/typecheck successfully. Backend tests use Node's built-in test runner through `npm test`; there is no backend `lint` script. See `FINAL_REPORT.md` for exact commands and outcomes.
- The spec's AI service is not inspectable in this checkout (only Python bytecode caches were present), so no claim is made about external/deployed service-token enforcement. The visible `backend-core` student submission routes enforce the student role and attempt ownership.
- Paper PDF is implemented through browser print/Save as PDF; the final QA did not run a real browser print dialog/output check. Populated chart/table/dialog states also were not exercised in the viewport browser smoke run.
