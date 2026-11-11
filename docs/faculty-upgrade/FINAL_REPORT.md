# Faculty Upgrade Final QA Report

Date: 2026-11-09  
Branch: `santhosh_branch`

## Summary

The final QA pass ran the build, lint (where configured), typecheck and test commands for `frontend-web` and `backend-core`. All configured builds, typechecks and test suites passed. No application code changes were necessary during this final QA task.

The regression review covered every area named in SPEC 21. The existing automated tests and source review provide evidence for those surfaces, but no live database/API was started, and no populated end-to-end browser workflows were run. SPEC 24 items are individually classified with evidence in [SECURITY_AND_REGRESSION_REPORT.md](SECURITY_AND_REGRESSION_REPORT.md).

## Features and implementation evidence

- Faculty registration accepts only normalized exact `@ch.amrita.edu` addresses, with frontend inline validation and backend enforcement on registration paths.
- Faculty identity and class/student scope are derived from the authenticated token. Report aggregation, directory/profile access, password-reset initiation, paper class selection/publishing, and poll targeting/results are scoped server-side.
- Student exam submission requires a STUDENT identity and an attempt owned by that student. Existing quiz attempt/response persistence remains the submission system.
- Faculty profile fields are read-only except password change; Department Enrollment is removed from the faculty navigation/routes while admin enrollment remains intact.
- Student reports and directory include cascading Year/Department/Section filters, pagination/search, profile navigation, and reset flow.
- Question Bank reuses the existing question types and image field, adds ownership/category/tag/usage support, and supports cross-category exclusion with explicit reuse override.
- Question papers retain exact selection and per-paper marks, support manual/random selection, class-scoped publishing, and feed the existing student assessment flow.
- Polls extend Announcement persistence and response behavior. Notifications reuse the existing notification model and read API; no duplicate notification system was introduced.
- Faculty screens received responsive and reduced-motion adjustments. Detailed API/data changes and routes are in [API_AND_DATA_DEPENDENCIES.md](API_AND_DATA_DEPENDENCIES.md).

## Security controls

- Exact faculty email domain checks on frontend and backend registration paths.
- Authenticated-token-derived faculty scope; user-supplied faculty IDs are not used as authority.
- Report queries are constrained to the authorized student set before search/aggregation; student profiles and reset targets are checked against scope.
- Password reset uses the existing provider flow and does not reveal credentials. No audit-log mechanism exists in the current repo.
- Question edits/deletes and poll results are ownership-scoped; class targets are checked server-side.
- Assessment response save/submit checks role and attempt ownership. The core API has no service-token submission path identified in source review.
- Limitation: the `backend-ai` source is missing from this checkout, so external AI/service paths cannot be fully audited. Automation operating through a valid student browser session is indistinguishable from that student to the current server checks. See the security report for details.

## Database and API changes

The earlier implementation adds additive Prisma migrations and API work for question bank ownership/category/tags/usage, paper state and selection, and structured announcement polls. Existing Notification, AnnouncementResponse, QuizAttempt and QuizResponse paths were reused where applicable. Specific routes and persistence contracts are listed in [API_AND_DATA_DEPENDENCIES.md](API_AND_DATA_DEPENDENCIES.md).

The final QA did not connect to PostgreSQL, apply migrations, or run requests against a live backend. Migration execution and live persistence therefore remain deployment checks, not verified outcomes of this report.

## Commands and results

| Workspace | Command | Result |
|---|---|---|
| `frontend-web` | `npm run build` | Passed: TypeScript project build and Vite production build. Warnings: Tailwind/lightningcss at-rules and bundle chunk size. |
| `frontend-web` | `npm run lint -- --quiet` | Passed, exit 0. |
| `frontend-web` | `npx tsc -b --pretty false` | Passed, exit 0. |
| `frontend-web` | `npm test` | Passed: 19 suites, 58 tests. |
| `backend-core` | `npm run build` | Passed: TypeScript compile. |
| `backend-core` | `npx tsc --noEmit` | Passed, exit 0. |
| `backend-core` | `npm test` | Passed: build plus 11 suites, 41 tests. |
| `backend-core` | `npm run lint` | Not configured; npm reports missing `lint` script. Fallback `frontend-web/node_modules/.bin/oxlint backend-core/src` exited 0 with warnings. |

## Regression results

SPEC 21 areas were reviewed: Student Dashboard, Faculty Dashboard, Admin Dashboard, faculty approval, quiz creation/evaluation, assignment management, submission tracking, grading, reports, announcements, surveys, and calendar/tasks. Automated suites passed and the existing routes/components were inspected. This was not a live role-by-role E2E run: no backend/database session, email delivery, populated admin/student workflow, or persisted mutation walkthrough was performed. The area-by-area evidence and limitations are in [SECURITY_AND_REGRESSION_REPORT.md](SECURITY_AND_REGRESSION_REPORT.md).

## Responsive results

The earlier Phase 7 headless Chrome smoke measured the Faculty Dashboard at 375, 430, 768, 1024 and 1440 CSS pixels across nine tabs (45 tab/width combinations). Document and main-content scroll widths matched the available widths after a narrow-screen calendar header overflow was corrected. The run used API error states because the backend was not running. Populated tables/charts and open dialogs were not visually exercised at these widths. Component tests and source review cover their states, but this is not equivalent to populated browser verification.

## SPEC 24 completion evidence

All 30 items are listed with an explicit status and evidence in [SECURITY_AND_REGRESSION_REPORT.md](SECURITY_AND_REGRESSION_REPORT.md). Items with material unverified live behavior are marked Partial, including external image upload, actual PDF print output, external AI-service enforcement, data-populated responsive visuals, and full end-to-end regression. Do not treat these partial items as fully verified.

## Known limitations and next verification

- `backend-ai` has no inspectable Python source, so external service authentication/submission behavior is unknown.
- Database migrations were not applied and database-backed API behavior was not exercised.
- Browser-session automation through an authenticated student account cannot be distinguished from the student.
- Cloudinary, provider email, live password reset, poll voting, persisted notification reads, grading, and PDF print-to-file were not exercised against live services.
- Backend package has no lint script; fallback oxlint completes with warnings.
- Production build reports existing CSS at-rule and bundle-size warnings.
- Full populated viewport/E2E validation still requires a running backend, initialized database, fixtures/test accounts, and external service credentials.

## Follow-up: Vite stylesheet overlay

After the report's QA pass, a Vite error overlay showed that `src/index.css` imported a missing `shadcn/tailwind.css`. That stale import was removed; the frontend production build now passes. The existing Tailwind/animation imports remain. This CSS-only follow-up did not rerun Jest; the pre-existing Jest 25 / jsdom 30 mismatch described above still prevents frontend tests from starting.

## Follow-up: user-facing server errors

On 2026-11-10, the Question Bank and Question Papers API surfaced Prisma's generated missing-column message directly in the UI. The backend now keeps exception details in server logs and sends human-readable 500 responses; missing-column errors tell the user the section is temporarily unavailable while a system update is completed. The two faculty screens show clear retry/admin-contact copy and suppress technical error-code suffixes. Backend and frontend production builds passed after the change; tests were not run.

