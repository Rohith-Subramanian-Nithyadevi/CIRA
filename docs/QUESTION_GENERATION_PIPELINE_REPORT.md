# Assignment and Test Question Generation Pipeline

## Executive summary

The application has several workflows that use the words *assignment* and *question*. They should not be conflated:

1. **Question papers** have an `ASSIGNMENT` or `TEST_QUIZ` category. Their “Generate random” action selects existing questions from the Prisma question bank; it does not write new question content.
2. **Faculty quiz authoring** creates test questions from faculty input: manual entry, pasted text parsed in the browser, or uploaded DOCX parsed by the backend. No AI question-generation call was found in this flow.
3. **Adaptive AI assignments** are described in the README, but their Python implementation is absent from the checkout. The intended flow is documented, but its actual generation algorithm, API, and persistence cannot be verified.
4. The regular faculty **Assignments** page creates a title, description, and class targets. It does not create assignment questions.

## 1. Question sources and storage

### Current Prisma question bank

The current faculty Question Bank provides a manual question editor. A question has a category (`ASSIGNMENT` or `TEST_QUIZ`), type, text, optional subject/topic/subtopic/difficulty/tags, marks, answer data, explanation, and optional image. Supported types are MCQ, multi-select, numerical, short/long written, matching, true/false, fill-in-the-blank, and coding.

On save, the UI posts the form to `/api/v1/faculty/quiz/question-bank`. The backend validates the category, type, required content, marks, answer/options for the selected type, and approved image references before saving a Prisma `Question` with the authenticated user as owner. Question image uploads use the configured object-storage service.

Relevant sources: [QuestionBank.tsx](../frontend-web/src/components/dashboard/QuestionBank.tsx), [question-bank.controller.ts](../backend-core/src/controllers/question-bank.controller.ts), [question-bank-policy.ts](../backend-core/src/utils/question-bank-policy.ts), and [schema.prisma](../backend-core/prisma/schema.prisma).

### Legacy spreadsheet import

There is a separate `/exams` Excel-import path. It parses spreadsheet rows, validates all rows, and transactionally writes them to the Mongoose `QuestionBank` collection. The current question-paper generator instead queries Prisma `Question` records. No synchronization between the legacy Mongoose collection and the Prisma question bank was found, so spreadsheet-imported records are not shown to be part of the current paper-generation pool.

Relevant sources: [exam.controller.ts](../backend-core/src/controllers/exam.controller.ts), [QuestionBank.ts](../backend-core/src/models/QuestionBank.ts), and [API_AND_DATA_DEPENDENCIES.md](./faculty-upgrade/API_AND_DATA_DEPENDENCIES.md).

## 2. Assignment and test question-paper workflow

This is the workflow behind the Question Papers page, whose UI says it creates assignments and tests using the shared question bank.

1. **Create a draft.** Faculty chooses `ASSIGNMENT` or `TEST_QUIZ`, enters paper metadata, and creates a draft through `POST /api/v1/faculty/quiz/question-papers`. Both paper types are represented by a `Quiz` record with `paperCategory` set to the selected category.
2. **Load eligible questions.** The UI loads bank questions for that category. Faculty can select questions manually or request a random selection. The filters include category, ownership/access, archive status, and optionally subject, topic, difficulty, and cross-category reuse.
3. **Generate a selection.** The UI sends a count and filters to `POST /api/v1/faculty/quiz/question-papers/:paperId/generate`. The backend validates the count (1–100), paper editability, replacement confirmation, and eligible pool size. It shuffles the eligible existing questions and takes the requested number. This is randomized **selection**, not AI authoring.
4. **Save the selection.** The paper stores `QuestionUsage` references to the selected question IDs, with category, marks, order, paper title, and whether a cross-category question was reused. The question text itself remains in the shared `Question` record. Manually selected questions use the same reference model.
5. **Assign and publish.** The paper must have questions and one authorized department or section to become ready. Publishing checks readiness and class authorization, changes the paper to `PUBLISHED`, and finalizes the question usages. Unless cross-category reuse is explicitly enabled, the pool excludes questions from the other category or questions with finalized opposite-category usage.
6. **Deliver to students.** The student exam endpoint checks publication and audience eligibility, combines direct quiz questions with finalized paper usages, and omits answer keys from the question payload. On the first attempt it deterministically shuffles the question pool for that student/attempt and, if configured, takes a subset. The chosen IDs/order are saved in attempt metrics so a resumed attempt gets the same questions in the same order.

Relevant sources: [QuestionPaperManagement.tsx](../frontend-web/src/components/dashboard/QuestionPaperManagement.tsx), [question-paper.controller.ts](../backend-core/src/controllers/question-paper.controller.ts), [question-paper-policy.ts](../backend-core/src/utils/question-paper-policy.ts), [quiz.routes.ts](../backend-core/src/routes/quiz.routes.ts), and [student-exam.controller.ts](../backend-core/src/controllers/student-exam.controller.ts).

## 3. Faculty quiz/test authoring workflow

The Quiz Management wizard is a separate way to create ordinary quizzes and their test questions:

1. Faculty enters quiz metadata, schedule, marks, and target audience.
2. Questions are supplied by faculty in one of three ways:
   - **Manual builder:** enter question text, type, options/answer, topic, and marks.
   - **Paste/import:** browser-side parsers split pasted text into supported question types and populate the editor. They transform supplied text; they do not generate original content.
   - **DOCX upload:** the UI posts a DOCX to `/api/v1/faculty/quiz/upload-docx`. The backend uses Mammoth to convert it to HTML and Cheerio to parse metadata, numbered questions, options, answers, and supported structures. Parsed questions return to the editor for faculty review.
3. Before saving, the UI checks question completeness, answer keys where applicable, required topics, duplicates, nonnegative marks, and any declared DOCX total-question/total-mark counts.
4. For a new quiz, the frontend first posts quiz metadata to `/api/v1/faculty/quiz/create`, then posts the question array to `/api/v1/faculty/quiz/:quizId/questions`. The backend creates Prisma `Question` rows in the `TEST_QUIZ` category and corresponding `QuestionUsage` rows. These are stored in the relational database.
5. For edits, the quiz update endpoint replaces or updates question records and preserves response relationships when attempts already exist; relevant answer/mark changes may trigger regrading or review handling.
6. At exam start, the student delivery path described above selects and orders the questions for that attempt.

Relevant sources: [QuizManagement.tsx](../frontend-web/src/components/dashboard/QuizManagement.tsx), [quiz.routes.ts](../backend-core/src/routes/quiz.routes.ts), and [quiz.controller.ts](../backend-core/src/controllers/quiz.controller.ts).

## 4. Adaptive AI assignment flow: documented intent vs. verifiable implementation

The README describes this intended sequence:

1. Identify a student's weak topics.
2. Match those topics with related question-bank topics.
3. Choose questions at an appropriate difficulty.
4. Generate a PDF assignment.
5. Return the PDF for download.

The README also says faculty can override the suggested difficulty.

Some inputs to such a flow exist in the core backend: quiz responses are grouped by question topic, and the analytics service computes topic scores and rule-based strengths/weaknesses. That analytics service explicitly describes itself as deterministic and “No AI.”

However, the `backend-ai/src` tree contains Python bytecode caches but no readable Python source, application entry point, dependency manifest, or inspectable API contract. In the TypeScript backend, `GeneratedAssignment` defines a Mongoose model with student ID, source result ID, topics, generated-question JSON, PDF URL, and status, but no references to that model were found outside its declaration. No active core-backend route connecting weak-topic analytics to assignment generation or PDF download was found.

Therefore, the AI pipeline above is **documented intent**, not a pipeline that can be fully verified from this repository snapshot. The model/provider, prompt or template, exact question retrieval and difficulty algorithm, API authentication, retry/error behavior, and whether it is deployed cannot be established from the available source.

Relevant sources: [README.md](../README.md), [analytics.service.ts](../backend-core/src/services/analytics.service.ts), [student-improvement.routes.ts](../backend-core/src/routes/student-improvement.routes.ts), [GeneratedAssignment.ts](../backend-core/src/models/GeneratedAssignment.ts), and [API_AND_DATA_DEPENDENCIES.md](./faculty-upgrade/API_AND_DATA_DEPENDENCIES.md).

## 5. Important distinction: regular assignments

The faculty Assignments page posts a title, description, and batch/department/section targets to the `/api/v1/assignments/faculty` endpoints. The corresponding Prisma `Assignment` model has submission and target relationships, but this controller path does not generate or attach questions. It is separate from an `ASSIGNMENT`-category question paper.

Relevant sources: [AssignmentManagement.tsx](../frontend-web/src/components/dashboard/AssignmentManagement.tsx), [assignment.controller.ts](../backend-core/src/controllers/assignment.controller.ts), [assignment.routes.ts](../backend-core/src/routes/assignment.routes.ts), and [schema.prisma](../backend-core/prisma/schema.prisma).

## Findings

- **Assignment/test paper generation:** selects existing bank questions; no new question text is generated by the “Generate random” action.
- **Quiz questions:** faculty-authored, parsed from faculty-supplied text, or extracted from a DOCX; no AI authoring call was found.
- **Question storage:** current paper workflow uses Prisma `Question` and `QuestionUsage`; legacy spreadsheet import uses a separate Mongoose collection.
- **Adaptive assignments:** described in documentation but not verifiable as active because the AI service source is missing and the `GeneratedAssignment` model has no observed call sites.
- **Validation scope:** this is a source-based report, not a live end-to-end run. A recent local backend session could not reach its configured PostgreSQL database, so live generation and persistence were not exercised.
