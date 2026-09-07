# Architectural Implementation Plan: Assignment Grading & Submissions View (Task 5)

## 1. Objective
Build the faculty-facing UI and backend support to view student submissions for an assignment, enter numerical grades and qualitative feedback, validate marks against `maxMarks`, and persist grading data with strict ownership authorization.

---

## 2. Architectural Findings & The Submission-Capture Gap (Architectural Risk #2)

> [!IMPORTANT]
> ### Submission-Capture Mechanism Analysis
> Per the roadmap execution instructions:
> *"Requires confirming a submission-capture mechanism exists (see Architectural Risk #2) — if none exists, Antigravity must stop and report this gap rather than fabricating a submissions table without understanding how submissions are actually created today."*
>
> Our thorough audit of `backend-core` and `frontend-web` revealed:
> 1. **Zero Submissions in DB**: Neon PostgreSQL currently has 4 assignments and 0 submissions (`AssignmentSubmission.count() == 0`).
> 2. **Missing Student Submission Endpoint**: `backend-core/src/controllers/assignment.controller.ts` contains `createAssignment`, `getFacultyAssignments`, `getStudentAssignments`, and `deleteAssignment`, but **no endpoint exists for a student to submit an assignment**.
> 3. **Missing Submission UI in Student Dashboard**: In `frontend-web/src/pages/StudentDashboard.tsx`, the `activeTab === 'assignments'` tab is currently a static placeholder (`"You currently have no assigned tasks."`).
> 4. **Prisma Model Gaps**:
>    - `Assignment` lacks a `maxMarks` field (currently only has `id`, `title`, `description`, `createdBy`, `createdAt`).
>    - `AssignmentSubmission` only has `rating: PerformanceRating?` (`EXCELLENT | GOOD | AVERAGE | POOR`) and `feedback: String?`. It lacks `grade: Float?` (numeric score), `fileUrl: String?`, and `submissionText: String?`.

---

## 3. Proposed Solution & Architecture

To satisfy TASK 5 without fabricating non-functional mocks while maintaining complete architectural integrity:

1. **Schema Enhancements (`schema.prisma`)**:
   - On `Assignment`: Add `maxMarks Float @default(100)`.
   - On `AssignmentSubmission`: Add `grade Float?`, `fileUrl String?`, `submissionText String?`.
   - Run `npx prisma db push` to synchronize safely with Neon PostgreSQL without data loss.

2. **Student Submission Mechanism (Closing the Gap)**:
   - Add `POST /api/v1/assignments/student/:assignmentId/submit` in `assignment.controller.ts`.
   - Allows a student to submit their assignment with optional file URL / text content.
   - Creates or updates an `AssignmentSubmission` record linked to the student and assignment.

3. **Faculty Submission & Grading Endpoints**:
   - **`GET /api/v1/faculty/assignments/:assignmentId/submissions`**:
     - **Authorization**: Confirms `assignment.createdBy === req.user.userId` (returns 403 otherwise).
     - **Data**: Queries all students assigned via `AssignmentStudent` and left-joins `AssignmentSubmission`.
     - **Returns**: Complete roster showing students who have submitted and students who have not yet submitted:
       ```json
       {
         "assignment": { "id": "...", "title": "...", "maxMarks": 100, "description": "..." },
         "summary": { "totalAssigned": 45, "submitted": 38, "graded": 20, "pending": 18 },
         "submissions": [
           {
             "studentId": "...",
             "studentName": "...",
             "rollNumber": "...",
             "status": "GRADED" | "SUBMITTED" | "NOT_SUBMITTED",
             "submissionId": "...",
             "submittedAt": "...",
             "fileUrl": "...",
             "submissionText": "...",
             "grade": 88,
             "feedback": "Great analysis on question 3"
           }
         ]
       }
       ```
   - **`PUT /api/v1/faculty/assignments/:assignmentId/submissions/:submissionId/grade`**:
     - **Authorization**: Verifies faculty owns the parent assignment.
     - **Validation**:
       - `grade` must be numeric.
       - `grade` must be within `[0, assignment.maxMarks]` (rejects with 400 if `< 0` or `> maxMarks`).
     - **Persistence**: Updates `grade`, `feedback`, and sets `rating` derived from percentage.
     - **Returns**: `{ success: true, data: { submissionId, grade, feedback, gradedAt } }`.

4. **Faculty Frontend UI (`AssignmentSubmissionsView.tsx` & `AssignmentManagement.tsx`)**:
   - In `AssignmentManagement.tsx`:
     - Add a **"View Submissions"** button on each assignment card with a badge showing submissions count.
     - Clicking transitions into the dedicated submissions grading view (with breadcrumb / back navigation).
   - In `AssignmentSubmissionsView.tsx`:
     - **Overview Bar**: Metrics showing Total Assigned, Submitted, Graded, and Ungraded count.
     - **Filter Tabs**: All | Submitted / Ungraded | Graded | Not Submitted.
     - **Grading Row / Table**:
       - Student Roll Number, Student Name, Submitted Timestamp.
       - Submission content/link preview.
       - Numeric Grade input with client-side real-time boundary validation against `maxMarks`.
       - Feedback input / textarea.
       - Save button with inline loader (`Loader2`), success toast/badge, and error banner that preserves the user's typed grade and feedback on network failure for immediate retry.
       - Ability to edit already-entered grades.

---

## 4. User Review Required

> [!NOTE]
> 1. **Schema Push**: We will add `maxMarks` to `Assignment` and `grade`, `fileUrl`, `submissionText` to `AssignmentSubmission` via `npx prisma db push`.
> 2. **Submission Ingestion**: We will add the student submission endpoint `POST /api/v1/assignments/student/:assignmentId/submit` so that real submissions can be created and graded.

---

## 5. Proposed Changes

### Backend (`backend-core`)

#### [MODIFY] [schema.prisma](file:///d:/GITHUB/CIRA/backend-core/prisma/schema.prisma)
- Add `maxMarks Float @default(100)` to `Assignment`.
- Add `grade Float?`, `fileUrl String?`, `submissionText String?` to `AssignmentSubmission`.

#### [MODIFY] [assignment.controller.ts](file:///d:/GITHUB/CIRA/backend-core/src/controllers/assignment.controller.ts)
- Add `getAssignmentSubmissions`: Fetch assigned students + submissions for faculty assignment with ownership check.
- Add `gradeSubmission`: Validate grade against `maxMarks`, enforce ownership, persist grade and feedback.
- Add `submitStudentAssignment`: Student-facing endpoint to submit an assignment.

#### [MODIFY] [assignment.routes.ts](file:///d:/GITHUB/CIRA/backend-core/src/routes/assignment.routes.ts)
- Mount `GET /faculty/:assignmentId/submissions`.
- Mount `PUT /faculty/:assignmentId/submissions/:submissionId/grade`.
- Mount `POST /student/:assignmentId/submit`.

---

### Frontend (`frontend-web`)

#### [NEW] [AssignmentSubmissionsView.tsx](file:///d:/GITHUB/CIRA/frontend-web/src/components/dashboard/AssignmentSubmissionsView.tsx)
- Dedicated submissions and grading view with roster table, status filters, grade inputs, and inline persistence.

#### [MODIFY] [AssignmentManagement.tsx](file:///d:/GITHUB/CIRA/frontend-web/src/components/dashboard/AssignmentManagement.tsx)
- Add `selectedAssignmentForSubmissions` state.
- Add "View Submissions" action button on each assignment card.
- Conditionally render `AssignmentSubmissionsView` when an assignment is selected.

---

## 6. Verification Plan

### Automated / API Verification
1. Run backend automated verification script:
   - Create test student submission.
   - Verify `GET /api/v1/faculty/assignments/:id/submissions` returns the submission.
   - Grade the submission via `PUT /api/v1/faculty/assignments/:id/submissions/:subId/grade`.
   - Verify grading past `maxMarks` is rejected with `400 Bad Request`.
   - Verify unauthorized faculty cannot grade another faculty's assignment (`403 Forbidden`).
2. Run `npx tsc --noEmit` in `backend-core`.
3. Run `npm run build` (`tsc -b && vite build`) in `frontend-web`.

### Manual / UI Verification
1. Navigate to Assignment Management tab.
2. Click "View Submissions" on an assignment.
3. Verify roster displays with distinct status badges (`Not Submitted`, `Submitted`, `Graded`).
4. Enter grade and feedback, click Save, refresh page, and verify persisted values.
