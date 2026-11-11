# Security and Regression Report (Baseline Skeleton)

> Initial source-level baseline against SPEC sections 2, 4 and 23. No tests were run. The documented AI service's Python source is absent from this checkout, limiting source-level verification of service identities.

## Existing controls observed

- [x] App JWT bearer auth middleware and role helper exist (`backend-core/src/middlewares/auth.middleware.ts`).
- [x] Student exam router applies STUDENT role guard; response save/submit checks attempt ownership.
- [x] Faculty quiz router applies FACULTY/ADMIN role guard; quiz controller contains creator checks for most mutations.
- [x] Admin router applies ADMIN role guard.
- [x] Email/password credentials are hashed with bcrypt; Firebase ID token is verified server-side.
- [x] Faculty registration begins in PENDING approval state; admin approval endpoint exists.
- [x] Upload size caps and file extension/MIME filters exist in route middleware.

## Security foundation changes and tests

- Faculty registration now trims/lowercases and requires an exact valid `@ch.amrita.edu` address in both email and Firebase registration handlers. Frontend shows inline validation on both registration forms.
- `attachFacultyScope` derives the faculty key exclusively from the authenticated token and attaches department/section classes plus the scoped student IDs for subsequent features.
- Student response save and submit explicitly require a STUDENT principal and matching attempt owner. The mounted student exam router also rejects all non-STUDENT roles.
- Faculty profile PUT rejects profile-field updates. Email/password faculty must provide the current password and an 8+ character new password; Google-auth users are directed to their provider.
- Backend tests: 13 focused security cases pass when run directly with `node --test tests/*.test.cjs` after TypeScript emits files. Frontend Jest: 10 suites / 33 tests pass. Frontend production build passes with existing Tailwind/lightningcss and large-chunk warnings.
- Backend `npm test` currently fails before running the tests because `npm run build` reports pre-existing stale generated Prisma model errors in `resource-sheet.controller.ts` (`sheetTopics`, `studentSheetProgress`, and `Resource.type`). `npx prisma generate` was attempted but failed to replace a locked Windows query-engine DLL (`EPERM`). The backend security tests themselves pass when run directly.

## Assessment automation limitation

The platform can enforce that an app-issued token represents an existing STUDENT role and that the attempt belongs to that student. It cannot determine whether a human or automation is operating through that student's already-authenticated browser session. This is the explicit limitation required by SPEC section 13. Any additional human-interaction attestation would require a separate product/security decision. No privileged AI submission endpoint was found in `backend-core`; `backend-ai` contains only compiled Python caches and no inspectable source, so its service authentication cannot be verified. The core API does not accept a separate service-token scheme for exam submission.

## Baseline findings to track

| ID | Finding | Severity / disposition | Regression coverage |
|---|---|---|---|
| R-01 | Student can call exam start with a known non-target quiz ID; start does not enforce eligibility targeting. | High; verify/fix in security phase | Pending |
| R-02 | Faculty dashboard routes authenticate without a router-level role allowlist. | Medium; handler access needs endpoint review | Pending |
| R-03 | Assignment routes authenticate globally but do not declare route-level roles. | Medium; confirm each controller role and ownership guard | Pending |
| R-04 | User-supplied class IDs in enrollment/quiz/assignment targeting need relationship and permission validation. | Medium; verify each write path | Pending |
| R-05 | Shared verification-code fields serve email verification and password reset; reset OTP attempt/rate limits not evident. | Medium; assess and test | Pending |
| R-06 | Quiz answer keys persist in Question and must remain excluded from student response payloads. | High impact if leaked; audit all serializers | Pending |
| R-07 | Disk-based upload temp files and extension-only checks require cleanup/content validation review. | Medium; test malformed inputs and cleanup paths | Pending |
| R-08 | No backend automated test runner exists in package scripts. | Regression gap; establish coverage strategy | Pending |
| R-09 | SPEC describes `backend-ai`, but checkout contains only `.pyc` caches; service routes, auth and assessment-submission paths cannot be audited. | High for the AI/service submission restriction; inspect source/deployment before sign-off | Pending |
| R-10 | App cannot identify automation that acts through a student's valid browser session and token. | Documented platform limitation; consider separate human-interaction attestation | Documented |

## Per-phase regression checklist (complete during work)

- Phase 0 baseline build/test commands and outcomes: not run; docs-only audit.
- Phase 1 auth/role/ownership/security tests: 13 backend focused cases and all 33 frontend Jest tests passed; backend build passed after Prisma Client generation.
- Phase 2 student scope, reports, directory, reset tests: backend 18 tests and frontend 37 tests passed.
- Phase 3 question bank: backend `npm test` passed (29 tests), frontend Jest passed (13 suites / 44 tests), and both builds passed.
- Phase 4 paper publishing and answer-key visibility tests: pending.
- Phase 5 poll targeting/response tests: pending.
- Phase 6 notification owner and read-state tests: pending.
- Phase 7 profile lock and navigation tests: pending.
- Phase 8 responsive, loading-state and regression checks: pending.

## Test inventory at baseline

- Frontend Jest + Testing Library. Available scripts: `npm test`, `npm run test:watch`; build `npm run build`; lint `npm run lint`.
- Backend has no configured test runner (`npm test` exits 1 by design); build script is `npm run build`.
- No tests were run for this documentation-only task.

## Outstanding evidence

- Full SPEC with sections 2, 4, 22, 23 and 24.
- Baseline frontend/backend build and tests before any application change.
- Tests proving route role gates, cross-user attempt denial, quiz target enforcement, answer-key non-disclosure, faculty cohort isolation, upload validation/cleanup, and password reset lifecycle.
- Inspectable `backend-ai` source or deployed API contract proving whether AI/service identities can reach assessment submission paths.


## Task 2 reports and student management verification

- Backend `npm test` passed: TypeScript build plus 18 Node security/scope tests. New cases verify filter composition within the token-derived ID set, pre-scoped list/options/report/search/profile database queries, direct out-of-scope reset rejection, and authorized reset without password disclosure.
- Frontend `npm test -- --runInBand` passed: 12 suites / 37 tests. The added reports and directory suites cover authorized cascade options, applied filters, search, profile navigation, reset confirmation/no duplicate submission, and error/retry behavior.
- `backend-core/npm run build` and `frontend-web/npm run build` passed. Vite emitted existing CSS at-rule and chunk-size warnings.
- The existing reset workflow stores a short-lived OTP and sends it to the student recovery email. No audit-log model or service exists, so reset initiation is not separately recorded.
- Browser-session automation limitation remains: role and attempt ownership checks cannot determine whether a person or automation is operating an already authenticated student session. The missing `backend-ai` source also prevents a complete audit of external service identities.

## Task 3 Question Bank verification

- Prisma schema formatting, validation, and Client generation passed.
- Backend `npm test` passed: build plus 29 Node tests. Question Bank tests cover all nine existing `QuestionType` values, per-type answer validation, category/search/metadata/pagination filters, opposite-category exclusions and explicit inclusion, MIME/extension/size rules, authenticated ownership, edit/delete ownership, usage recording, and assessment deletion preserving questions.
- Frontend `npm test -- --runInBand` passed: 13 suites / 44 tests. Question Bank tests cover category divisions, reuse warning/override, all type-specific editors, create/preview, image upload-preview-remove, and error/retry states.
- Backend and frontend builds passed. Vite emitted existing Tailwind/lightningcss unknown-at-rule and large-chunk warnings.
- Migration is additive and was not applied to a database in this task. No live database migration test was performed.

## Task 4 Question Paper regression notes

- Paper authorization uses the token-derived faculty class scope and owner identity. Publish rechecks class scope server-side; student exam start requires a published Quiz target matching the logged-in student's department, section, or explicit user target.
- Existing QuizAttempt and QuizResponse persistence remains the only submission mechanism. Paper question usage supplies per-paper marks during response validation and objective grading. Answer keys are excluded from start-exam question projections.
- Browser print / Save as PDF contains the student paper selection and does not render answer keys. PDF output was not exercised in a real browser session.
- As documented earlier, browser-session automation using a valid authenticated student identity cannot be distinguished from the student by server checks alone.

## Task 5 Poll security and regression notes

- Poll creation, target discovery, list and results routes require Faculty/Admin role. Faculty scope is attached from the authenticated token; submitted audience IDs are resolved and checked against that scope. Batch audiences require assignment to every department in that batch.
- Faculty list and results queries are restricted to `facultyId` from the token. Poll responses are visible to faculty as aggregates only.
- Student poll listing and voting both check structured target IDs against the authenticated student's current batch, department or section. Voting checks start/expiry and exact option membership, then uses the existing unique response key and a create-only path to reject repeat votes.
- Existing free-text surveys retain their current response behavior. `backend-ai` is unavailable in this repo; this task adds no AI response route.
- The additive migration has not been applied to a database. Browser-based end-to-end voting was not run.

## Task 6 Notification security and regression notes

- Reused the existing Notification rows and faculty endpoints. Read state only changes through the existing individual PATCH endpoint; merely opening the popover does not mark items read.
- GET is scoped to `req.user.userId`; PATCH confirms the row's `facultyId` matches that identity. Both routes now enforce Faculty/Admin role.
- Mark-all-read was omitted because the API only supports individual updates and has no atomic bulk operation. The UI makes individual persisted updates.
- Existing 30-second polling cadence was retained and centralized in the workspace notification provider. The title/category/destination are inferred from `type`; this schema has only `type`, `message`, `read`, and `createdAt`.

## Final QA evidence (2026-11-09)

### Commands actually run

| Area | Command | Result |
|---|---|---|
| Frontend production build | `frontend-web: npm run build` | Passed (`tsc -b && vite build`); emitted existing CSS at-rule and large-bundle warnings. |
| Frontend lint | `frontend-web: npm run lint -- --quiet` | Passed, exit 0. |
| Frontend typecheck | `frontend-web: npx tsc -b --pretty false` | Passed, exit 0. |
| Frontend tests | `frontend-web: npm test` | Passed: 19 suites, 58 tests. |
| Backend production compile | `backend-core: npm run build` | Passed (`tsc`). |
| Backend typecheck | `backend-core: npx tsc --noEmit` | Passed, exit 0. |
| Backend tests | `backend-core: npm test` | Passed: build plus 11 suites, 41 Node tests. |
| Backend lint | `backend-core: npm run lint` | Not available: package has no `lint` script. Fallback `frontend-web/node_modules/.bin/oxlint backend-core/src` exited 0 with warnings. |

No changes to application code were needed to fix a failure in this QA task. The lint-script absence and warnings are reported as tooling limitations rather than build/test failures.

### SPEC 21 regression walk-through

| Existing area | Evidence and result | Scope/limitation |
|---|---|---|
| Student Dashboard | Frontend suite passed; student announcement/poll interaction and route components inspected. | No live API/database or populated browser session. |
| Faculty Dashboard | Frontend suite passed; responsive smoke selected 9 faculty tabs at five widths; source/component tests cover touched tabs. | Browser smoke exercised API error states. |
| Admin Dashboard | Shared app/frontend test suite passed; admin routes and approval behavior inspected. | No dedicated live admin workflow run. |
| Faculty approval | Auth/security source and automated backend tests reviewed; registration remains PENDING until admin approval. | No live email/approval integration. |
| Quiz creation and evaluation | Existing quiz APIs/components, paper integration and backend tests passed. | No live persisted quiz creation/evaluation session. |
| Assignment management | Existing assignment routes/components and assignment-related question usage integration inspected; all suites passed. | No live assignment workflow; existing assignment subsystem is not the paper submission mechanism. |
| Submission tracking | Existing QuizAttempt/QuizResponse flow retained; backend security and question-paper suites passed. | No live student attempt session. |
| Grading | Existing evaluation flow and paper-specific marks mapping inspected/tested in backend suite. | No live grade persistence/session. |
| Reports | Report scope/filter backend tests and StudentReports component tests passed. | No populated live-data chart review. |
| Announcements | Existing announcement APIs plus poll extension tests passed. | No live API session. |
| Surveys | Existing free-text survey flow preserved by source review; suite passed. | No separate live survey response walkthrough. |
| Calendar and tasks | Existing components/routes remained; frontend suite/build passed and calendar layout was included in viewport smoke. | Smoke used API error state; no persisted event/task create/edit walkthrough. |

This satisfies a source/test regression pass for the listed surfaces, not a full end-to-end functional sign-off. The current browser evidence is limited to viewport overflow checks and screenshots in API error states.

### SPEC 24 definition-of-done evidence

Status key: **Verified in code/tests** means implementation and relevant automated coverage were inspected/run; **Partial** means the inspected implementation exists but an important external/live behavior was not exercised; **Not verified** means evidence is insufficient to claim completion.

| # | Status | Evidence |
|---:|---|---|
| 1 | Verified in code/tests | Exact-domain normalization/validation in auth controller and `facultyEmail` helper; backend security tests. |
| 2 | Verified in code/tests | Both faculty registration UI validation and both backend registration paths; frontend/backend tests. |
| 3 | Verified in code/tests | Existing Notification model/API and persisted read endpoint reused; notification tests cover loading, read state, unread count/persistence behavior. |
| 4 | Verified in code/tests | Poll create/target/publish implementation and backend/frontend poll tests. |
| 5 | Verified in code/tests | Persistent Announcement/AnnouncementResponse path and aggregation tests; zero-response percentages handled as null. |
| 6 | Verified in code/tests | Year/department/section filters and cascading filter options in reports API/UI tests. |
| 7 | Verified in code/tests | Token-derived faculty scope applied before report query/aggregation; direct out-of-scope tests. |
| 8 | Verified in code/tests | Existing loading states retained; report, directory, bank, paper, poll and notification component tests/build passed. |
| 9 | Verified in code/tests | Dedicated Question Bank screen/API; QuestionBank tests passed. |
| 10 | Verified in code/tests | Assignment versus Test/Quiz category and filtering; category tests passed. |
| 11 | Verified in code/tests | Tags and categorization fields/filtering; bank backend/frontend tests. |
| 12 | Verified in code/tests | All nine existing `QuestionType` values validated in backend and supported by editor component tests. |
| 13 | Partial | Existing Cloudinary upload with image validation and UI preview/replace/remove tests; no live Cloudinary upload/render session. |
| 14 | Verified in code/tests | Opposite-category usage excluded by default; eligibility/filter tests. |
| 15 | Verified in code/tests | Explicit include-reused path and warning recorded in usage; backend/frontend tests. |
| 16 | Verified in code/tests | Paper-specific marks stored on usage relation and total validation tested. |
| 17 | Verified in code/tests | Random selection, uniqueness and insufficient-pool behavior covered by paper tests. |
| 18 | Partial | Print view and answer-key exclusion implemented in source; real browser print-to-PDF output was not run. |
| 19 | Verified in code/tests | Faculty scope checked on class selection/publish; authorization and idempotent publish covered by backend tests. |
| 20 | Partial | Core submission APIs require STUDENT role and attempt ownership; tests reject non-student/service-like principals. External AI service source/deployment is unavailable, so external paths cannot be certified. |
| 21 | Verified in code/tests | Faculty enrollment nav/route removed or guarded; admin enrollment/API untouched; frontend route tests passed. |
| 22 | Verified in code/tests | Faculty fields read-only except password; profile component/security tests passed. |
| 23 | Verified in code/tests | Directory query uses authenticated faculty scope; list and scope tests passed. |
| 24 | Verified in code/tests | Directory response/render includes name, roll number, department, year, section; component/API tests passed. |
| 25 | Verified in code/tests | Existing OTP/reset-provider flow initiated for authorized student; reset tests verify no password disclosure. No live email delivery was tested. |
| 26 | Verified in code/tests | Server-side student-class checks for profile/reset and scope-constrained reports; direct API negative tests passed. |
| 27 | Verified in code/tests | Feature component tests cover loading/empty/error/retry/success paths where applicable; no live-service state-transition run. |
| 28 | Partial | Headless Chrome checked 9 faculty tabs at 375, 430, 768, 1024, 1440px for horizontal overflow. Populated tables/charts/dialogs were not browser-rendered. |
| 29 | Partial | All automated suites passed and the regression surfaces above were inspected; only limited browser smoke was possible, not full role-by-role E2E. |
| 30 | Verified | Frontend/backend builds, typechecks, lint availability/results, test counts and caveats documented here and in `FINAL_REPORT.md`. |

### Remaining security and verification limits

- The documented `backend-ai` service source is absent, so its authentication, service identities and any external assessment submission route remain unaudited. No claim is made that every external AI path is blocked.
- Browser-session automation cannot be distinguished from a human using a student's valid authenticated session. Controls establish role and attempt ownership.
- The additive Prisma migrations were not applied to a live database. API persistence and migration rollout need a database-backed deployment check.
- No live provider email, Cloudinary upload, poll vote, notification update, password reset, grading, or PDF print session was run in this final QA task.
- `backend-core` has no lint script. The fallback oxlint run completed with warnings; warnings were not treated as errors.
- Existing frontend production build warnings include unrecognized Tailwind/lightningcss at-rules and a bundle chunk over the configured size threshold.

## Follow-up: server error disclosure and faculty messaging (2026-11-10)

- The Express error middleware now logs detailed exception text/stack server-side but returns a generic, plain-language message for unexpected 500 errors. Development stacks are no longer placed in API error details. Expected `AppError` and validation responses retain their status/message and validation details.
- Prisma `P2022` (missing column) is returned as `ERR_FEATURE_UNAVAILABLE` with a message that the section is temporarily unavailable while a system update is completed, and directs the user to retry/contact an administrator. It does not disclose model/column names or generated Prisma query text.
- Question Bank and Question Papers use human-readable operation-specific fallbacks for other 5xx errors; their API error formatter omits internal code suffixes for these messages.
- Frontend and backend production builds passed. No automated tests were run for this follow-up. The unrelated Jest 25 / jsdom 30 mismatch still prevents frontend tests from initializing.
