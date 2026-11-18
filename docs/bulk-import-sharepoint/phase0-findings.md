# Phase 0 Repository Findings: Question Import and Assignments

Read-only repository audit. No application source files were changed. Each finding is marked:

- **CONFIRMED**: verified in checked-in source or configuration.
- **CORRECTED**: the shared context needs qualification or differs from the current checkout.
- **NOT FOUND**: no checked-in implementation/configuration was found in the searched scope; this does not prove that an external deployment has none.

Source paths below are relative to the repository root. Line anchors refer to the current checkout.

## Verified file map

| Path | Role |
|---|---|
| [backend-core/prisma/schema.prisma](../../backend-core/prisma/schema.prisma#L29-L44) | Prisma enums and Question, QuestionUsage, Assignment, and assignment-target models. |
| [backend-core/src/utils/question-bank-policy.ts](../../backend-core/src/utils/question-bank-policy.ts#L1-L144) | Question-bank filters, payload validation/normalization, ownership checks, image checks, and reuse eligibility. |
| [backend-core/src/controllers/question-bank.controller.ts](../../backend-core/src/controllers/question-bank.controller.ts#L10-L79) | Prisma question-bank list/create/update/archive and image-upload handlers. |
| [backend-core/src/routes/quiz.routes.ts](../../backend-core/src/routes/quiz.routes.ts#L30-L66) | Authenticated faculty quiz/question-bank routes and upload middleware. |
| [frontend-web/src/components/dashboard/QuestionBank.tsx](../../frontend-web/src/components/dashboard/QuestionBank.tsx#L97-L177) | Question-bank filters, manual create/edit, image upload, and archive request. |
| [backend-core/src/controllers/question-paper.controller.ts](../../backend-core/src/controllers/question-paper.controller.ts#L105-L121) | Question-paper selection and QuestionUsage persistence. |
| [backend-core/src/utils/question-paper-policy.ts](../../backend-core/src/utils/question-paper-policy.ts#L1-L26) | Question-paper selection validation and duplicate-ID checks. |
| [frontend-web/src/components/dashboard/QuestionPaperManagement.tsx](../../frontend-web/src/components/dashboard/QuestionPaperManagement.tsx#L41-L69) | Draft, manual/random question selection, save, and publish requests. |
| [backend-core/src/controllers/quiz.controller.ts](../../backend-core/src/controllers/quiz.controller.ts#L1456-L1656) | DOCX-to-HTML parsing, metadata/question construction, validation, and response. |
| [frontend-web/src/components/dashboard/QuizManagement.tsx](../../frontend-web/src/components/dashboard/QuizManagement.tsx#L63-L555) | Paste parsers; DOCX review, duplicate, completeness, and metadata checks. |
| [backend-core/src/models/QuestionBank.ts](../../backend-core/src/models/QuestionBank.ts#L1-L27) | Separate legacy Mongoose QuestionBank model. |
| [backend-core/src/controllers/exam.controller.ts](../../backend-core/src/controllers/exam.controller.ts#L1-L5) | Legacy spreadsheet import uses the Mongoose model, not Prisma Question. |
| [backend-core/src/controllers/assignment.controller.ts](../../backend-core/src/controllers/assignment.controller.ts#L5-L445) | Regular assignment CRUD, target materialization, student listing/submission, and grading. |
| [backend-core/src/routes/assignment.routes.ts](../../backend-core/src/routes/assignment.routes.ts#L11-L20) | Faculty and student assignment endpoints and route-level auth. |
| [frontend-web/src/components/dashboard/AssignmentManagement.tsx](../../frontend-web/src/components/dashboard/AssignmentManagement.tsx#L144-L207) | Faculty assignment list/create/update/delete requests. |
| [frontend-web/src/pages/StudentDashboard.tsx](../../frontend-web/src/pages/StudentDashboard.tsx#L94-L98) | Student dashboard placeholder; no implemented assignment list/detail client was found. |
| [backend-core/src/app.ts](../../backend-core/src/app.ts#L47-L57) | Express JSON middleware and route mounts. |
| [backend-core/package.json](../../backend-core/package.json#L4-L8) | Backend build, test, and dev scripts. |
| [frontend-web/package.json](../../frontend-web/package.json#L7-L13) | Frontend build, lint, test, and dev scripts. |
| [frontend-web/jest.config.cjs](../../frontend-web/jest.config.cjs#L1-L14) | Jest environment, test discovery, module mapping, and transforms. |
| [docker-compose.yml](../../docker-compose.yml#L4-L14) | Local Postgres 15 service and loopback port mapping. |
| [README.md](../../README.md#L157-L181) | Local Docker startup and documented database environment variable. |
| [backend-core/prisma/migrations/](../../backend-core/prisma/migrations/) | Three checked-in SQL migration directories; no baseline migration or migration lock file was present. |

## A. Question Bank and validation

### 1. Prisma `Question` model

**CONFIRMED.** `QuestionType` is `MCQ | MULTI_SELECT | NUMERICAL | SHORT_WRITTEN | LONG_WRITTEN | MATCHING | TRUE_FALSE | FILL_BLANK | CODING`; `QuestionCategory` is `ASSIGNMENT | TEST_QUIZ`. There is **no `QuestionDifficulty` Prisma enum**: `Question.difficulty` is `String?`. The policy accepts `Easy`, `Medium`, or `Hard` when difficulty is supplied. [schema enums](../../backend-core/prisma/schema.prisma#L29-L44) [Question model and indexes](../../backend-core/prisma/schema.prisma#L209-L239) [policy validation](../../backend-core/src/utils/question-bank-policy.ts#L73-L134)

Scalar fields: `id String @id @default(uuid())`; nullable `quizId`, `ownerId`, `subject`, `topic`, `subtopic`, `difficulty`, `archivedAt`, `topicId`, `explanation`, and `image`; `category QuestionCategory @default(TEST_QUIZ)`; required `type QuestionType`, `text String`, and `marks Float`; `tags String[] @default([])`; `createdAt DateTime @default(now())`; and `negativeMarks Float @default(0)`. Relations are optional `topicRef`, `quiz`, and `owner`, plus `responses[]` and `usages[]`. `ownerId` relates to `User` with `SetNull`, and `image` is a nullable string reference. There is no unique text/content index. Indexes are `ownerId`, `category`, and `archivedAt`. [Question model](../../backend-core/prisma/schema.prisma#L209-L239)

`options` and `answerKey` are nullable Prisma `Json`; Prisma does not enforce per-type JSON structure. The policy's current normalized shapes/rules are:

| Type | Current policy shape/rule |
|---|---|
| `MCQ` | `options: string[]`; `answerKey: string` matching an option. |
| `MULTI_SELECT` | `options: string[]`; `answerKey: string[]`. |
| `MATCHING` | Options normalize to `{ left: string, right: string }[]`; a same-length answer array is required, and the normalized options are stored as the answer key. |
| `NUMERICAL` | Answer key normalizes to a number. |
| `TRUE_FALSE` | Answer key normalizes to a boolean. |
| `FILL_BLANK` | Answer key must be a nonempty string. |
| `CODING` | Answer key must be a nonempty reference-solution string. |
| `SHORT_WRITTEN`, `LONG_WRITTEN` | No type-specific answer/options validation; answer data passes through. |

For non-matching types, supplied array options are normalized to trimmed strings. Text is trimmed; tags are trimmed, empty values removed, and deduplicated; marks must be positive. These are policy rules, not database constraints. [Question policy](../../backend-core/src/utils/question-bank-policy.ts#L79-L134)

### 2. `question-bank-policy.ts` exports and purity

**CONFIRMED.** Exported functions and signatures (return types not explicitly annotated by the source are marked inferred):

| Function | Signature / classification |
|---|---|
| `isAllowedQuestionImage` | `(mimeType: string, fileName: string) => boolean` (inferred). Pure value check. [L22-L25](../../backend-core/src/utils/question-bank-policy.ts#L22-L25) |
| `parseQuestionBankFilters` | `(query: Record<string, unknown>): QuestionBankFilters`. No request/DB access, but malformed input throws an HTTP `BadRequestError`. [L28-L47](../../backend-core/src/utils/question-bank-policy.ts#L28-L47) |
| `buildQuestionBankWhere` | `(filters: QuestionBankFilters, userId: string, isAdmin = false): Prisma.QuestionWhereInput`. No Prisma client access; pure query-object construction, but the result is Prisma-shaped. [L49-L71](../../backend-core/src/utils/question-bank-policy.ts#L49-L71) |
| `validateQuestionBankPayload` | `(input: any) => <inferred normalized payload>`. No DB access, but uses HTTP errors and `normalizeStoredImageValue` from object storage. [L73-L135](../../backend-core/src/utils/question-bank-policy.ts#L73-L135) |
| `assertQuestionEditable` | `(question: { ownerId: string \| null }, userId: string, isAdmin = false) => void` (inferred). Value check, but failure throws HTTP `ForbiddenError`. [L137-L139](../../backend-core/src/utils/question-bank-policy.ts#L137-L139) |
| `questionReuseStatus` | `(usages: Array<{ category: QuestionCategory; assessmentTitle: string; isFinalized?: boolean }>, intendedCategory: QuestionCategory) => { eligible: boolean; usedInOppositeCategory: boolean; warning: string \| null }` (return inferred). Pure value calculation. [L141-L144](../../backend-core/src/utils/question-bank-policy.ts#L141-L144) |

The module also exports `QuestionBankFilters`, `QUESTION_IMAGE_MAX_BYTES`, and `QUESTION_IMAGE_MIME_EXTENSIONS`. It imports Prisma enums/types, HTTP error classes, and a storage normalization helper; it does not receive `req`/`res` or use a Prisma client. [imports and exports](../../backend-core/src/utils/question-bank-policy.ts#L1-L25)

To expose a pure `validateQuestionDraft(draft, category)`, give it a typed draft and explicit category; have it return normalized data plus structured validation issues (or throw a non-HTTP domain error). Keep `BadRequestError` mapping in the controller adapter and move `normalizeStoredImageValue` to the storage/persistence boundary. Avoid `any` and do not duplicate the type-specific validation. The adapter can preserve the current HTTP response contract.

### 3. Question-bank handlers, access, archive, and list behavior

**CONFIRMED.** `GET /api/v1/faculty/quiz/question-bank` calls `listQuestionBank`, which applies parsed filters, paginates (default page 1/limit 20, limit capped at 100), includes owner/usage relations, resolves image values, and returns reuse/ownership status. The query does not require an associated `QuestionUsage`, so an otherwise eligible unused question still appears. It does filter out finalized opposite-category usages by default unless reuse is requested. [list handler](../../backend-core/src/controllers/question-bank.controller.ts#L10-L33) [filter builder](../../backend-core/src/utils/question-bank-policy.ts#L28-L71)

Faculty listing includes their own, ownerless, and admin-owned questions; other faculty-owned questions are not shared. Admin listing is not owner-restricted. Create assigns `ownerId` from the authenticated user. Update loads a non-archived question and permits its owner or an admin; it validates a full payload, defaulting category from the existing record. Delete is wired to archive behavior: it sets `archivedAt` rather than deleting the row, with the same owner/admin edit check. [controller handlers](../../backend-core/src/controllers/question-bank.controller.ts#L36-L69) [routes/auth](../../backend-core/src/routes/quiz.routes.ts#L44-L52) [ownership and archive filter](../../backend-core/src/utils/question-bank-policy.ts#L49-L71)

The UI uses category, search, subject, topic, difficulty, type, tag, reuse, page, and limit filters; it manually creates/edits with POST/PUT and sends DELETE for removal/archive. [QuestionBank list and save](../../frontend-web/src/components/dashboard/QuestionBank.tsx#L97-L151) [remove](../../frontend-web/src/components/dashboard/QuestionBank.tsx#L177)

### 4. Duplicate detection

**CORRECTED.** The Quiz Management client compares `(q.text || '').trim().toLowerCase()`. It does not collapse internal whitespace or normalize punctuation. No server-side duplicate-text check was found in question-bank create/update or quiz create/update/add-question paths. Question Paper selection rejects repeated question IDs, which is not the same as duplicate-text detection. [client duplicate check](../../frontend-web/src/components/dashboard/QuizManagement.tsx#L1194-L1244) [question-bank writes](../../backend-core/src/controllers/question-bank.controller.ts#L36-L58) [quiz writes](../../backend-core/src/controllers/quiz.controller.ts#L339-L366) [paper ID validation](../../backend-core/src/utils/question-paper-policy.ts#L10-L26)

### 5. Image upload and approved references

**CONFIRMED with a scope caveat.** Question Bank sends multipart field `file` to `POST /api/v1/faculty/quiz/question-bank/upload-image`. The route uses authenticated faculty/admin access and in-memory Multer, one image up to 5 MiB, with extension/MIME checks for PNG, JPG/JPEG, and WebP. The controller uploads the buffer through object storage; the returned reference is placed in the question's `image` string. [UI upload](../../frontend-web/src/components/dashboard/QuestionBank.tsx#L165-L166) [route middleware](../../backend-core/src/routes/quiz.routes.ts#L30-L50) [controller upload](../../backend-core/src/controllers/question-bank.controller.ts#L73-L79)

`uploadBufferToObjectStorage` requires configured storage, nonempty content, and an allowed MIME type; it stores a random key under `cira-quiz-images/` and returns a presigned URL. The policy normalizes/accepts `cira-quiz-images/...` keys, HTTPS `neon.tech` URLs, and HTTPS `res.cloudinary.com` URLs. **The payload check is broader than the upload route:** it checks the reference's form/domain, not that the object exists, its bytes are safe, or that this request produced that reference. [image-reference policy](../../backend-core/src/utils/question-bank-policy.ts#L21-L25) [reference validation](../../backend-core/src/utils/question-bank-policy.ts#L92-L100) [storage helpers](../../backend-core/src/utils/object-storage.ts#L62-L115) [upload helper](../../backend-core/src/utils/object-storage.ts#L166-L179)

The legacy general image-upload route is separate from the Question Bank image route and uses disk-backed Multer. Do not treat either image upload or the legacy spreadsheet import as a SharePoint import implementation. [legacy route/controller](../../backend-core/src/routes/quiz.routes.ts#L11-L29) [legacy upload handler](../../backend-core/src/controllers/quiz.controller.ts#L1669-L1684)

## B. Parsing and upload limits

### 6. DOCX parser output, markers, and limitations

**CONFIRMED.** Authenticated faculty/admin route `POST /api/v1/faculty/quiz/upload-docx` uses `upload.single('file')` and Mammoth to convert DOCX to HTML before Cheerio traversal. Success is HTTP 200 with `{ status: 'success', data: { metadata, questions } }`. [route/mount](../../backend-core/src/routes/quiz.routes.ts#L64) [app mount](../../backend-core/src/app.ts#L50) [Mammoth and metadata](../../backend-core/src/controllers/quiz.controller.ts#L1456-L1478) [response](../../backend-core/src/controllers/quiz.controller.ts#L1656)

`metadata` has `title`, `subject`, `instructions` defaulting to `''`, and `totalMarks`, `totalQuestions` defaulting to `0`. Recognized metadata labels are `Quiz Title:`, `Subject:`, `Instructions:`, `Total Marks:`, and `Total Number of Questions:`. [metadata parsing](../../backend-core/src/controllers/quiz.controller.ts#L1471-L1478) [markers](../../backend-core/src/controllers/quiz.controller.ts#L1539-L1543)

Each question starts with `type: 'MCQ'`, `text: ''`, `marks: 1`, `options: []`, `answerKey: null`, `explanation: null`, `hasImagePlaceholder: false`, and parser-working fields `_left`, `_right`, `_mapping` (empty arrays). Those working fields are included in emitted questions. `image` is added dynamically when an image is encountered. [question defaults](../../backend-core/src/controllers/quiz.controller.ts#L1569-L1572) [push/finalization](../../backend-core/src/controllers/quiz.controller.ts#L1640-L1656)

Supported `Question Type:` labels map to MCQ, numerical, short written, long written, matching, or fill-in-the-blank. There is no DOCX mapping for multi-select, true/false, or coding. Other markers include `Question Number:`, `Question Text:`, `Image:`, `Marks:`, `Explanation:`, `Option A:` through `Option D:`, `Correct Answer:`, `Correct Numerical Answer:`, expected-answer/evaluation-guideline labels, left/right columns, and `Correct Mapping`. [type mapping](../../backend-core/src/controllers/quiz.controller.ts#L1574-L1582) [question markers](../../backend-core/src/controllers/quiz.controller.ts#L1560-L1635)

The parser checks question text or an actual parsed image, truthy marks, MCQ options/answer, matching content, and non-null expected answers for supported written/numerical/fill types. It checks declared question count only when nonzero. `totalMarks` is parsed but not compared server-side with the question-mark sum; Quiz Management performs client-side declared-count/marks and completeness checks before save. `Image:` by itself only marks a placeholder. Actual `<img>` content adds an image reference (storage URL or source string). Table semantics are not parsed: traversal selects headings, paragraphs, list items, and images, not table cells/rows. [server checks](../../backend-core/src/controllers/quiz.controller.ts#L1483-L1537) [count check and response](../../backend-core/src/controllers/quiz.controller.ts#L1651-L1665) [client validation](../../frontend-web/src/components/dashboard/QuizManagement.tsx#L1194-L1209)

### 7. Paste parsers

**CONFIRMED.** Six top-level parsers are currently colocated in `QuizManagement.tsx`: MCQ, short written, numerical, long written, matching, and fill blanks. They take raw text and return question-like objects; they are not currently in a shared module. Numbered questions and `Question N`/`Q N` delimiters are recognized. MCQ supports letter/number option markers and answer markers; other parsers recognize `Answer`, `Correct`, or `Ans`, and relevant parsers also recognize `Expected Answer`/`Key`. Matching accepts `->`, `=>`, `=`, or `:` pairs; fill-blank parsing normalizes underscore runs. Defaults vary by type (MCQ/numerical/fill 1 mark, short 2, long 5, matching at least 1 or pair count). The import flow assigns the selected/custom topic or quiz subject. [parser functions](../../frontend-web/src/components/dashboard/QuizManagement.tsx#L63-L555) [bulk import/selected topic](../../frontend-web/src/components/dashboard/QuizManagement.tsx#L1391-L1453)

They are reasonable candidates for extraction as pure functions, provided the question shape/types are shared and the extraction preserves all existing parser formats and defaults. No AI-generated content is involved.

### 8. Dependencies, Multer, body limits, and proxy limits

**CONFIRMED.** Backend dependencies include Mammoth, Cheerio, Multer, `xlsx`, and `docx`; `busboy` is transitive. `xlsx` supports the separate legacy Excel import. No PDF parser/rendering library was found among the checked dependency manifests/lockfile (including no `pdf-parse`, `pdfjs-dist`, or `pdf-lib`). Frontend CSV parsing is implemented in repository code rather than a separate CSV parser dependency. [backend dependencies](../../backend-core/package.json#L25-L36) [lockfile packages](../../backend-core/package-lock.json#L1796) [CSV utility](../../frontend-web/src/lib/csv.ts)

The shared DOCX upload middleware uses disk storage under `uploads/`, a 10 MiB/file limit, one file, and a filename-extension filter that permits `.docx`, `.xlsx`, `.png`, `.jpg`, and `.jpeg` (not MIME validation). The Question Bank image endpoint has its own memory storage, 5 MiB, one-file, extension/MIME filter. [shared Multer setup](../../backend-core/src/routes/quiz.routes.ts#L15-L27) [image Multer setup](../../backend-core/src/routes/quiz.routes.ts#L30-L42)

`express.json()` has no repository-specific `limit`; no explicit `express.urlencoded()` limit was found. No checked-in reverse-proxy/API upload body-size limit was found. `docker-compose.yml` configures databases; `frontend-web/vercel.json` contains SPA rewrites, not an API upload limit. External hosting/proxy configuration cannot be verified from this checkout. [Express middleware](../../backend-core/src/app.ts#L47) [Vercel rewrite config](../../frontend-web/vercel.json#L1-L8)

## C. Assignments

### 9. Prisma `Assignment` and relations

**CONFIRMED.** Scalar fields are `id` (UUID), `title`, optional `description`, `createdBy`, `maxMarks` (default 100), and `createdAt`. Relations include submissions, question usages, and target join records for batches, departments, sections, and individual students. `createdBy` is not declared as a User relation. There is no `dueDate` field. [Assignment model](../../backend-core/prisma/schema.prisma#L357-L372) [target relations](../../backend-core/prisma/schema.prisma#L417-L454)

`AssignmentSubmission` relates to Assignment/User and stores file URL, submission text, rating/grade, feedback, and submitted time. Target joins are `AssignmentBatch`, `AssignmentDepartment`, `AssignmentSection`, and `AssignmentStudent`, each with composite identity and cascading relations. [submission model](../../backend-core/prisma/schema.prisma#L374-L386) [target join models](../../backend-core/prisma/schema.prisma#L417-L454)

### 10. Assignment API handlers and validation

**CONFIRMED.** Assignment router is mounted at `/api/v1/assignments`. Faculty routes are `POST/GET /faculty`, `PUT/DELETE /faculty/:id`, `GET /faculty/:assignmentId/submissions`, and `PUT /faculty/:assignmentId/submissions/:submissionId/grade`; student routes are `GET /student` and `POST /student/:assignmentId/submit`. Faculty routes require auth and FACULTY/ADMIN; student routes authenticate but have no role middleware. [mount](../../backend-core/src/app.ts#L57) [routes](../../backend-core/src/routes/assignment.routes.ts#L11-L20)

Create accepts `title`, `description`, `targetBatches`, `targetDepartments`, and `targetSections`; it writes assignment metadata/targets plus `AssignmentStudent` rows. Update is **PUT**, updates title/description, and replaces provided target arrays; it rebuilds student mappings when a target array is supplied. These handlers do not write question text or `QuestionUsage`. Create/update use direct body reads rather than a Zod/Joi/schema validator. Grade validation checks numeric range against max marks. [create](../../backend-core/src/controllers/assignment.controller.ts#L7-L64) [update](../../backend-core/src/controllers/assignment.controller.ts#L71-L166) [grade validation](../../backend-core/src/controllers/assignment.controller.ts#L353-L360)

`GET /faculty` is the faculty assignment list handler; the router has no `GET /faculty/:id` detail route. Separate handlers list submissions and grade a submission. [faculty list](../../backend-core/src/controllers/assignment.controller.ts#L205-L257) [routes](../../backend-core/src/routes/assignment.routes.ts#L11-L16)

Target IDs are accepted from the request and used to build target relations; no caller-authority check for those IDs was found. Also, although the update route permits ADMIN, the update handler requires creator ownership; delete has a separate admin override. [target writes](../../backend-core/src/controllers/assignment.controller.ts#L25-L64) [update ownership](../../backend-core/src/controllers/assignment.controller.ts#L83-L94) [delete authorization](../../backend-core/src/controllers/assignment.controller.ts#L258-L271)

The faculty UI sends the same target fields to `POST`/`PUT` `/api/v1/assignments/faculty`. [AssignmentManagement form/list](../../frontend-web/src/components/dashboard/AssignmentManagement.tsx#L144-L207)

### 11. Student assignment list/detail and access

**CORRECTED.** Backend student endpoints exist, but no working student assignment list/detail UI or frontend client call to them was found. `StudentDashboard.tsx` shows a “My Assignments” placeholder. [student dashboard](../../frontend-web/src/pages/StudentDashboard.tsx#L94-L98) [student routes](../../backend-core/src/routes/assignment.routes.ts#L19-L20)

At creation, target batch/department/section conditions are combined to select student users, then `AssignmentStudent` rows are materialized. `GET /api/v1/assignments/student` filters by the authenticated user's ID in that join table and includes that user's submissions; it does not re-check current batch/department/section enrollment at read time. Submit checks the `(assignmentId, userId)` assignment-student record and returns 403 when absent. [target creation](../../backend-core/src/controllers/assignment.controller.ts#L25-L64) [student list](../../backend-core/src/controllers/assignment.controller.ts#L173-L198) [submit authorization](../../backend-core/src/controllers/assignment.controller.ts#L383-L399)

List returns `{ success: true, data: [...] }`; each assignment object includes the filtered `submissions` relation plus `submitted: boolean` and `submission: matchingSubmission | null`. Submit returns `{ success: true, data: submission }`. The student routes rely on authentication plus the join-row check, not a student-role route middleware. [student list payload](../../backend-core/src/controllers/assignment.controller.ts#L173-L198) [submit response](../../backend-core/src/controllers/assignment.controller.ts#L390-L445) [route middleware](../../backend-core/src/routes/assignment.routes.ts#L19-L20)

### 12. Microsoft Graph / SharePoint

**NOT FOUND in checked-in code/config.** A case-insensitive repository search found no Microsoft Graph, `graph.microsoft`, SharePoint, or MSAL implementation/configuration. Azure SDK-related lockfile entries (`@azure/core-auth`, `@azure/identity`, `@azure/storage-blob`) exist, but are not evidence of Graph/SharePoint integration. Untracked secret environment files and external deployment settings were not opened and cannot be attested to. [Azure-related lock entries](../../backend-core/package-lock.json#L2199-L2201) [additional Azure entries](../../backend-core/package-lock.json#L2257-L2263)

## D. Tooling and database

### 13. Test runners, fixtures, and local PostgreSQL

**CONFIRMED.** Backend `npm test` first runs `npm run build`, then `node --test tests/*.test.cjs`. There are 12 backend `.test.cjs` files under `backend-core/tests`. Frontend `npm test` runs Jest serially/no-watch; Jest uses jsdom, `src/**/*.test.{ts,tsx}`, Babel transforms, and `src/test/setupTests.ts`. The current checkout has 27 frontend test files. Relevant checked-in tests include `backend-core/tests/question-paper.test.cjs`, `backend-core/tests/security.test.cjs`, `frontend-web/src/components/dashboard/QuestionBank.test.tsx`, `QuizManagement.test.tsx`, and `frontend-web/src/lib/csv.test.ts`. No fixture-named directory/file was found in the searched backend/frontend trees. [backend scripts](../../backend-core/package.json#L4-L8) [frontend scripts](../../frontend-web/package.json#L7-L13) [Jest config](../../frontend-web/jest.config.cjs#L1-L14)

Commands from the repository root:

```powershell
npm --prefix backend-core test
npm --prefix frontend-web test
npm --prefix frontend-web run build
```

The repository config **can** start local Postgres on a host with Docker Compose: from repo root run `docker compose up -d postgres`, then `docker compose ps postgres`; the Postgres 15 service maps to `127.0.0.1:5432` and persists in a named volume. Set `DATABASE_URL` to the local connection value documented in `README.md`; do not reuse development credentials outside local development. [Compose service](../../docker-compose.yml#L4-L14) [README startup and DB config](../../README.md#L157-L181)

**Current environment check:** Docker CLI is not installed (`docker` was not recognized), and TCP port 5432 did not accept a connection. PostgreSQL therefore could not be started or verified in this environment. A fresh database also needs an explicit schema/migration decision; see item 14.

### 14. Prisma migration workflow and current state

**CORRECTED.** `backend-core/prisma/migrations/` currently contains three SQL migration directories:

1. `20261109090000_question_bank/migration.sql` — creates `QuestionCategory`, alters the existing `Question` table, creates `QuestionUsage`, and adds indexes.
2. `20261110090000_question_papers/migration.sql` — adds paper status/category fields and QuestionUsage selection/finalization fields/indexes.
3. `20261111090000_announcement_polls/migration.sql` — alters the existing Announcement table and adds indexes.

These are feature migrations against existing tables, not a complete baseline schema for a blank database. No `migration_lock.toml` was present. `backend-core/package.json` has no `prisma migrate dev`/`prisma migrate deploy` script, and no such standard workflow was found in the current README. Older documents still mention `npx prisma db push`; two faculty-upgrade audit documents say the migrations directory is absent, which is stale relative to this checkout. [question-bank migration](../../backend-core/prisma/migrations/20261109090000_question_bank/migration.sql#L1-L43) [question-paper migration](../../backend-core/prisma/migrations/20261110090000_question_papers/migration.sql#L1-L27) [poll migration](../../backend-core/prisma/migrations/20261111090000_announcement_polls/migration.sql#L1-L10) [older `db push` references](../implementation_plan.md#L32-L32) [stale directory status](../faculty-upgrade/API_AND_DATA_DEPENDENCIES.md#L56-L56)

No live database connection was available, so whether any environment has applied these migrations is **NOT VERIFIED**. Recommendation: reconcile the deployed schema/history with these checked-in SQL files, add/verify the expected Prisma migration metadata, and document one non-destructive release workflow before using `migrate deploy`. Treat `db push` references as historical guidance, not proof that it is the active deployment workflow.

## Data-flow summary

| Flow | Verified path |
|---|---|
| Manual Question Bank create | Faculty editor submits the form to `POST /api/v1/faculty/quiz/question-bank`; authenticated controller validates/normalizes and creates a Prisma Question with the authenticated user as owner. Image upload is a separate multipart request that returns a storage reference. [UI](../../frontend-web/src/components/dashboard/QuestionBank.tsx#L134-L166) [route/controller](../../backend-core/src/routes/quiz.routes.ts#L44-L52) [create](../../backend-core/src/controllers/question-bank.controller.ts#L36-L44) |
| Question Paper selection | UI loads eligible existing bank questions, allows selecting IDs/marks, or posts filters/count to `.../question-papers/:id/generate`. Backend randomizes the eligible existing pool and saves `QuestionUsage`; publish finalizes usage. It does not author text. [UI](../../frontend-web/src/components/dashboard/QuestionPaperManagement.tsx#L41-L69) [selection persistence](../../backend-core/src/controllers/question-paper.controller.ts#L105-L121) [publish](../../backend-core/src/controllers/question-paper.controller.ts#L282-L294) |
| DOCX upload | UI uploads faculty-provided DOCX to `/api/v1/faculty/quiz/upload-docx`; server uses Mammoth/Cheerio and returns parsed draft metadata/questions to the Quiz Management editor. Upload alone does not save questions; faculty review and the normal quiz/question write flow follow. [route](../../backend-core/src/routes/quiz.routes.ts#L64) [parser response](../../backend-core/src/controllers/quiz.controller.ts#L1456-L1656) [editor handling](../../frontend-web/src/components/dashboard/QuizManagement.tsx#L1171-L1209) |
| Regular assignment create | Faculty UI posts title/description/selected target IDs to `/api/v1/assignments/faculty`; controller creates Assignment and target/student join rows. It is not the ASSIGNMENT-category Question Paper flow. [UI](../../frontend-web/src/components/dashboard/AssignmentManagement.tsx#L177-L207) [controller](../../backend-core/src/controllers/assignment.controller.ts#L7-L64) |
| Student assignment view | No implemented student list UI found. The backend `GET /api/v1/assignments/student` returns assignments linked through `AssignmentStudent`, including user-filtered submissions and `submitted`/`submission` convenience fields. [student placeholder](../../frontend-web/src/pages/StudentDashboard.tsx#L94-L98) [endpoint](../../backend-core/src/controllers/assignment.controller.ts#L173-L198) |

The old Excel import remains a separate Mongoose path and has no demonstrated synchronization with Prisma Question. It is not a suitable destination for a new bulk-import feature. [legacy Mongoose model](../../backend-core/src/models/QuestionBank.ts#L1-L27) [spreadsheet handler and insert](../../backend-core/src/controllers/exam.controller.ts#L1-L5) [Mongoose insertMany](../../backend-core/src/controllers/exam.controller.ts#L92-L97)

## Discrepancies versus the shared context

| Topic | Shared context | Verified repo finding |
|---|---|---|
| Difficulty | Enum might be implied by the field description. | **CORRECTED:** `difficulty` is nullable `String`; there is no Prisma difficulty enum. The policy restricts supplied values. |
| JSON shapes | Fields exist for answers/options. | **CONFIRMED with detail:** Prisma stores generic nullable JSON; policy enforces type-specific shapes for most, not all, types. |
| Image references | “Approved image refs” are checked. | **QUALIFIED:** checks enforce reference patterns/domains and image upload checks MIME/extension, but payload validation does not establish object ownership, existence, or provenance. |
| Duplicate detection | Quiz Management performs client checks. | **QUALIFIED:** exact key is trimmed/lowercased text only; no server-side duplicate-text check was found. |
| DOCX parsing | Mammoth/Cheerio parse a faculty DOCX. | **QUALIFIED:** returns internal `_left/_right/_mapping` fields and `hasImagePlaceholder`; tables are not structured; DOCX type mapping excludes multi-select, true/false, coding; server parses total marks but does not check the sum. |
| Regular assignments | Metadata/targets only, separate from papers. | **CONFIRMED:** controller writes metadata and target/student relations, no questions/QuestionUsage. Assignment model also has `maxMarks` and submission/usage relations; it has no due date. |
| Student assignment UI | Not previously inspected. | **CORRECTED:** endpoints exist, but the frontend has only a dashboard placeholder and no working assignment list/detail client found. |
| Graph/SharePoint | Believed absent. | **CONFIRMED within checked-in repo:** no Graph/SharePoint/MSAL implementation/config found; Azure SDK-related lockfile entries exist for other Azure libraries. |
| Migration state | Prior docs describe no migration directory / no applied migrations. | **CORRECTED:** three migration SQL directories now exist; no baseline or lock file was found, and application status cannot be verified without DB access. |
| Local PostgreSQL | Prior session could not reach configured DB. | **CONFIRMED for this environment:** Compose config exists, but Docker is unavailable here and localhost:5432 is closed. |

## Risks and unresolved decisions

1. **Pure validation boundary:** current validator accepts `any`, throws HTTP errors, and normalizes image storage references. Recommendation: extract only deterministic draft validation/normalization into a typed pure function, preserve the current adapter, and keep storage operations outside it.
2. **Image trust boundary:** valid-looking host/key strings are not proof that an image is owned, safe, or present. Recommendation: decide whether the API should accept only server-issued object keys or a defined trusted-host set, and verify object ownership/existence at the persistence boundary without logging signed URLs.
3. **Duplicate semantics:** `.trim().toLowerCase()` is weaker than canonical normalization and only client-side. Recommendation: define normalization and collision behavior before bulk import; enforce it server-side if duplicate prevention is a correctness requirement.
4. **Parser contract:** DOCX and paste paths accept different subsets; DOCX omits several QuestionType values and table structure, and generated objects contain parser-working fields. Recommendation: define a versioned, typed parser draft shape and fixture-based coverage for supported/unsupported structures before wiring a new import source.
5. **Declared counts/marks:** DOCX count is conditionally checked server-side; total marks is only parsed server-side and checked by the client. Recommendation: decide whether a server-side discrepancy should block saving and apply one shared validation rule.
6. **Assignment student experience:** backend student endpoints exist without a student UI; target matching is materialized into join rows and not rechecked against current enrollment on read. Recommendation: confirm whether assignments are enrollment snapshots or must follow current roster changes before implementing student views.
7. **Assignment target authorization:** request target IDs are written without a demonstrated caller-scope check, and admin update behavior differs from its route authorization. Recommendation: resolve and enforce target authorization server-side before relying on client-selected targets.
8. **Migration/deployment workflow:** checked-in feature migrations have no baseline/lock metadata and the database is unavailable here. Recommendation: reconcile the deployed schema, establish a baseline and migration workflow, and validate on a disposable local database before touching shared data.
9. **External Graph configuration:** no repository Graph integration was found, but external tenant/deployment settings were not inspected. Recommendation: require a documented integration contract and secret-management plan before treating SharePoint as available.

## Audit validation

This was a read-only source/configuration audit; no application tests or migrations were run and no source files were modified. The local database availability check found no Docker CLI and no listener on `127.0.0.1:5432`.
