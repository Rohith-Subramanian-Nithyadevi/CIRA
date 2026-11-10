# CIRA – FACULTY DASHBOARD FUNCTIONALITY, QUESTION BANK, STUDENT MANAGEMENT AND UX UPGRADE

## 1. YOUR ROLE

Act as a Principal Full-Stack Engineer, Senior React and TypeScript Developer, Backend Architect, Database Engineer, Security Engineer, UI/UX Designer and QA Engineer.

You are working on the existing CIRA application.

Your task is to implement the faculty requirements described in this document directly in the existing repository.

This is an existing production-oriented application. You must understand its architecture and preserve all existing features before introducing modifications.

**This is an implementation task. Do not stop after producing a plan or describing what needs to be changed.**

Inspect the source code, implement the required functionality, connect frontend and backend, test the changes and document your results.

---

# 2. PROJECT ARCHITECTURE

CIRA is a college-readiness, assessment, and student-improvement platform supporting students, faculty and administrators.

The documented architecture is:

### Frontend
- React 19.
- Vite 8.
- TypeScript.
- React Router.
- Tailwind CSS.
- CSS variables.
- TanStack Query.
- Recharts.
- Lucide React.
- TipTap.
- Sonner notifications.

Frontend directory:

`frontend-web`

Shared API client:

`frontend-web/src/lib/apiClient.ts`

### Core backend
- Express 5.
- TypeScript.
- Prisma.
- PostgreSQL.

Backend directory:

`backend-core`

### AI service
- FastAPI.
- Python.
- MongoDB.

AI service directory:

`backend-ai`

Do not assume that documented files, routes, or data models are unchanged. Inspect the actual repository.

---

# 3. SCOPE OF THIS IMPLEMENTATION

The primary objective is to improve the Faculty Dashboard and implement the following requirements:

1. Faculty email-domain validation.
2. Functional notification centre.
3. Poll creation and management within Announcements.
4. Improved Student Reports filters and faculty-specific student scoping.
5. Separate faculty Question Bank.
6. Question categorization and image/question-type support.
7. Assignment and Test/Quiz question separation.
8. Question-paper creation, randomization, individual marks, download and publishing.
9. Prevention of AI/service agents submitting assessments on behalf of students.
10. Removal of Department Enrollment from the Faculty Dashboard.
11. Read-only faculty profile except for password changes.
12. Faculty student-directory management.
13. Secure password-reset capability for authorized students.
14. Responsive and polished laptop/mobile experiences.
15. Preservation of existing loading indicators and working functionality.

## Backend scope clarification

Most UI changes should be implemented in `frontend-web`.

However, certain requirements need real server-side functionality. You are permitted to make narrowly scoped changes in:

- `backend-core`.
- Prisma schema and additive database migrations.
- Existing authentication and authorization services.
- Existing assessment and announcement persistence logic.

Only modify backend functionality when it is necessary for the requirements in this document.

Do not perform an unrelated backend rewrite.

Do not change the AI service unless an existing integration must be examined to enforce assessment-submission restrictions.

If a feature is already supported by an existing API, reuse it.

If it is not supported, identify the exact missing capability and implement the smallest safe extension that fits existing architecture.

---

# 4. MANDATORY PRE-IMPLEMENTATION AUDIT

Before changing code, inspect the entire relevant implementation.

## 4.1 Git safety

Run:

`git status`

Verify:

- Current branch.
- Uncommitted changes.
- Modified files.
- Untracked files.

The expected working branch is `santhosh_branch`, but verify it rather than assuming it.

Do not discard or overwrite existing user changes.

Do not run:

- `git reset --hard`
- `git clean -fd`
- Destructive database commands.
- Force pushes.
- Automatic destructive migrations.

Do not change branches without authorization.

Do not edit `.env` files or expose credentials.

## 4.2 Frontend inspection

Inspect:

- FacultyDashboard.
- FacultyHome.
- StudentReports.
- StudentProfileView.
- QuizManagement.
- AssignmentManagement.
- AssignmentSubmissionsView.
- UserProfile.
- DashboardLayout.
- ProtectedRoute.
- Shared navigation.
- Existing notifications.
- Existing announcement forms.
- Existing calendar and task components.
- Shared UI components.
- Existing loading indicators.

## 4.3 Backend inspection

Inspect:

- Faculty authentication.
- Faculty registration and approval.
- Student authentication.
- Faculty/student relationships.
- Class and cohort assignments.
- Batch, department, year and section models.
- Student listing endpoints.
- Reports APIs.
- Quiz and question models.
- Assignment models.
- Announcement and survey models.
- Notification persistence.
- Password reset implementation.
- Assessment submission authorization.
- Existing file upload mechanisms.

## 4.4 Database inspection

Inspect the actual Prisma schema and existing database migrations.

Identify:

- How faculty are associated with classes.
- How students are associated with classes.
- Whether faculty can be assigned multiple batches, departments or sections.
- Existing question and question-paper models.
- Existing assignment and quiz relations.
- Existing announcement and poll/survey structures.
- Existing notification models.
- Authentication provider relationships.

Do not invent new entities before examining the existing data model.

## 4.5 Baseline report

Create:

`docs/faculty-upgrade/BASELINE_AUDIT.md`

Document the existing structure, relevant API contracts, data relationships, existing workflows and technical risks.

---

# 5. FACULTY EMAIL VALIDATION

## Requirement

Faculty email addresses must be restricted to:

`@ch.amrita.edu`

Only valid addresses belonging to this exact domain should be accepted for faculty registration or other applicable faculty-account creation workflows.

## Frontend requirements

Implement clear inline validation:

- Validate email format.
- Validate the permitted faculty domain.
- Trim accidental spaces.
- Handle uppercase/lowercase domain consistently.
- Show a clear validation message.
- Prevent submission when invalid.

Example accepted:

`faculty@ch.amrita.edu`

Examples rejected:

`faculty@gmail.com`

`faculty@amrita.edu`

`faculty@ch-amrita.edu`

`faculty@evilch.amrita.edu`

## Backend requirements

Frontend validation must never be the only security check.

Implement the same domain validation on the server wherever faculty accounts are registered or created.

Normalize and validate the email address safely.

Do not accidentally accept similar-looking or malicious domains.

Return a structured validation error using the existing API error convention.

Do not change student or administrator email rules unless their existing requirements specifically demand it.

## Acceptance criteria

- Valid `@ch.amrita.edu` addresses are accepted.
- Other domains are rejected for faculty registration.
- Direct API requests cannot bypass the domain restriction.
- The validation message is understandable.
- Existing faculty login and approval workflows remain functional.

---

# 6. NOTIFICATION CENTRE – RELOCATE AND MAKE FULLY FUNCTIONAL

## Requirement

Notifications must be moved into a more appropriate and accessible location in the Faculty Workspace and made fully functional.

## Recommended placement

Provide:

1. A notification bell in the global header.
2. A dedicated Notifications destination or full-page view.
3. An unread count indicator.
4. A dropdown or popover showing recent notifications.

Use the existing notification functionality and endpoints wherever possible.

The documented existing routes include:

- `/api/v1/faculty/dashboard/notifications`
- `/api/v1/faculty/dashboard/notifications/:id/read`

Verify the actual implementations before using them.

## Notification interface

Include:

- Notification title.
- Notification description.
- Timestamp.
- Notification category, where supported.
- Read/unread state.
- Relevant icon.
- Navigation action.
- Mark as read action.

Provide filters:

- All.
- Unread.
- Read.

Add a mark-all-as-read action only if it can be supported safely.

## Interaction requirements

- Opening a notification should navigate to the relevant faculty workflow when a destination exists.
- The unread count must update after reading notifications.
- Notifications should remain in their correct state after refresh.
- Notification polling or refresh should follow existing architecture.
- Avoid unnecessarily aggressive polling.
- Loading, error and empty states must be implemented.

Do not create duplicate notification systems.

## Acceptance criteria

- Notification bell is visible and accessible.
- Unread count reflects actual data.
- Read state persists.
- Navigation works.
- Notifications work across laptop and mobile.
- Existing notification functionality is preserved.

---

# 7. ANNOUNCEMENTS – ADD POLL CREATION

## Requirement

Add poll creation functionality to the existing Announcements module.

Faculty should be able to create and publish polls to their assigned student groups.

## Poll creation interface

Add a clear action:

`Create Poll`

The poll editor should support:

- Poll question.
- Multiple answer options.
- Adding answer options.
- Removing options before publishing.
- Audience selection.
- Batch targeting.
- Department targeting.
- Section targeting.
- Start time, if supported.
- Closing/expiry time.
- Preview.
- Publish action.

Reuse the existing announcement audience-targeting functionality.

Do not duplicate faculty targeting logic.

## Poll management interface

Show polls separately or through a filter inside Announcements.

Suggested filters:

- All.
- Published.
- Active.
- Closed.

Use only statuses that exist or can be implemented consistently.

Each poll card should show:

- Poll question.
- Target audience.
- Publication date.
- Expiry information, if present.
- Participation count, if supported.
- Current status.
- View results action.

## Poll results

Display:

- Answer options.
- Response counts.
- Percentages.
- Total responses.

Provide a visually clear chart or result bars.

Do not display misleading percentages when there are no responses.

Respect any existing privacy restrictions on student responses.

## Backend and persistence

Inspect existing survey functionality before creating a new poll model.

Reuse existing survey capabilities if they provide suitable behaviour.

If new persistence is necessary, implement the smallest appropriate schema and API extension.

Use server-side validation.

Enforce audience authorization.

Prevent duplicate responses where required by the existing survey policy or explicitly defined poll behaviour.

Make poll publication and response operations persistent.

## Acceptance criteria

- Faculty can create polls.
- Polls can be targeted to authorized classes.
- Students can participate through the appropriate existing student experience.
- Results are stored correctly.
- Faculty can inspect results.
- Polls remain functional after refresh.
- Unauthorized users cannot manage another faculty member's polls.

Do not create a frontend-only fake poll experience.

---

# 8. STUDENT REPORTS – IMPROVED FILTERING AND FACULTY-SCOPED DATA

## Requirement

Student Reports must support:

1. Year.
2. Department.
3. Section.

The displayed students must dynamically reflect the students enrolled in classes assigned to the logged-in faculty member.

## A. Filter structure

Create a clear filter toolbar containing:

- Year selector.
- Department selector.
- Section selector.
- Assessment/quiz selector where already supported.
- Student search.

Use cascading filters:

- The Year options must reflect authorized faculty scope.
- Department options must correspond to the selected/authorized academic scope.
- Section options must correspond to the selected department and year.
- Student results must respect all selected filters.

Do not show filters that expose unrelated departments or cohorts.

## B. Dynamic student population

The reports page must display only students belonging to classes assigned to the current faculty member.

Do not use the full institutional student list unless authorization explicitly permits it.

The same restrictions must apply to:

- Report summaries.
- Student search.
- Leaderboards.
- Topic analytics.
- Student profile drill-down.
- Export and print.
- Comparative charts.

## C. Backend authorization

This is a critical security requirement.

Do not rely on frontend filters for access control.

For every relevant API request:

- Identify the authenticated faculty member.
- Obtain their permitted classes.
- Restrict the student dataset to those classes.
- Apply the selected Year, Department and Section filters only within that authorized set.

A faculty member must not be able to access another faculty member's students by manually changing query parameters or request bodies.

Apply the authorization before aggregation and reporting.

## D. Preserve existing report functionality

Do not remove:

- Performance-band charts.
- Topic-wise class averages.
- Comparative quiz performance.
- Student leaderboard.
- Student search.
- Student profile drill-down.
- Print/export functionality where available.

## E. Loading indicators

**All existing loading indicators in Student Reports must be retained.**

Preserve and improve:

- Initial loading.
- Filter-dependent loading.
- Chart skeletons.
- Student list loading.
- Student profile loading.
- API error states.
- Empty states.

When filters change, provide clear loading feedback.

Do not show stale data as though it belongs to the newly selected filters.

Do not treat an API failure as an empty student list.

## Acceptance criteria

- Year, Department and Section filters work.
- Filters show only authorized values.
- Student records change dynamically based on filters.
- Students outside faculty scope never appear.
- Direct API requests cannot bypass the restriction.
- Existing charts and report interactions continue functioning.
- Loading indicators remain visible and correct.

---

# 9. DEDICATED QUESTION BANK FOR FACULTY

## Requirement

Add a separate Question Bank section in the Faculty Dashboard.

It must be a genuine reusable question-management system.

It must not simply be another page listing questions attached to a particular quiz.

## A. Navigation

Add:

`Assessments → Question Bank`

Ensure the navigation points to a real implemented page.

Do not create duplicate question-management functionality.

## B. Question Bank divisions

Provide two clear divisions:

### 1. Assignments

Questions intended for assignment question sets.

### 2. Tests / Quizzes

Questions intended for tests and quizzes.

Keep the collections logically distinct.

## C. Question categorization

Each question should support the applicable existing metadata, including:

- Subject.
- Department or academic domain, where relevant.
- Topic.
- Subtopic.
- Category.
- Difficulty level.
- Question type.
- Tags.
- Marks.
- Creation date.
- Created by.
- Associated assessment category.

Inspect the current question model before determining exact fields.

Do not introduce meaningless duplicate category fields.

Support search and filters.

Suggested filters:

- Assignment Questions.
- Test/Quiz Questions.
- Subject.
- Topic.
- Difficulty.
- Question Type.
- Tags.

## D. Support all existing question types

Inspect the complete current CIRA question system.

Identify every available question type and ensure the Question Bank supports all of them.

Do not assume that only multiple-choice questions exist.

Depending on actual project support, these may include:

- Single-choice MCQ.
- Multiple-select.
- True/False.
- Fill in the blanks.
- Short answer.
- Descriptive questions.
- Coding/programming questions.
- Image-based questions.
- Other existing custom question formats.

Do not remove a question type that is already supported elsewhere in CIRA.

Each question type must retain the correct editor, validation, answer structure and rendering behaviour.

## E. Image-based questions

Support images within question content where appropriate.

Allow:

- Uploading an image.
- Displaying attached images.
- Previewing images.
- Removing/replacing images during editing.
- Preserving image references when editing questions.
- Rendering images correctly in question previews and generated papers.

Reuse existing secure file-upload mechanisms.

Do not store arbitrary image contents as unvalidated HTML.

Validate file types, file size and upload permissions using existing upload conventions.

## F. Question creation and editing

The editor should provide:

- Question content.
- Question type selector.
- Subject/topic/category.
- Difficulty.
- Image upload.
- Answer options where relevant.
- Correct answer where relevant.
- Explanation where supported.
- Individual marks.
- Tags.
- Preview.
- Save action.

Use existing question validation rules.

## G. Question ownership and access

Faculty should be able to manage their own questions.

If CIRA already supports institution-level shared question banks, preserve that behaviour and distinguish owned, shared and inaccessible questions appropriately.

Do not allow faculty to edit another faculty member's private questions.

## Acceptance criteria

- Separate Assignment and Test/Quiz collections.
- Questions can be created, edited, searched and filtered.
- All existing question types work.
- Image questions work.
- Category and tag information persists.
- Question ownership is respected.
- Question data remains available after refresh.

---

# 10. QUESTION REUSE RULES

This requirement is critical.

Questions used in Assignments should not automatically be repeated in Tests/Quizzes, and questions used in Tests/Quizzes should not automatically be repeated in Assignments.

However, faculty must be able to explicitly select a previously used question when necessary.

## Required behaviour

When creating a question paper:

1. Identify the intended usage category.
2. Retrieve eligible questions from that category.
3. Exclude questions used in the opposite category by default.
4. Provide an explicit option to reuse excluded questions.
5. Display a clear warning when a previously used question is selected.
6. Record the reuse association so that future selection remains accurate.

Example:

- Assignment question used in Assignment A.
- It should not appear automatically in a Test/Quiz question pool.
- Faculty can explicitly select it after acknowledging the reuse warning.

Likewise:

- Test/Quiz question used in Quiz A.
- It should not automatically appear in an Assignment question pool.
- Faculty can explicitly select it.

Do not silently override this rule.

## Data and integrity requirements

Inspect how existing question usage is represented.

If necessary, introduce an appropriate question-to-assessment usage relation.

Prevent duplicate questions within the same generated paper unless the existing assessment design intentionally allows them.

Ensure reuse history remains accurate after editing or deleting assessments.

Do not delete original question-bank records when an assessment is removed.

---

# 11. QUESTION PAPER CREATION AND RANDOMIZATION

Add a complete faculty question-paper generation workflow.

## A. Create question paper

Faculty should be able to:

1. Select Assignment or Test/Quiz.
2. Enter paper title.
3. Enter instructions if supported.
4. Select subject or topic filters.
5. Select difficulty filters where appropriate.
6. Select the intended class.
7. Choose questions manually or generate them randomly.
8. Assign marks to individual questions.
9. Preview the paper.
10. Save the paper.

## B. Manual question selection

Allow faculty to browse the eligible Question Bank and select specific questions.

Show:

- Question.
- Type.
- Topic.
- Difficulty.
- Marks.
- Existing usage information.

Allow removal or replacement before saving.

## C. Random question generation

Support random selection based on:

- Number of questions.
- Assignment/Test category.
- Selected subject.
- Topic.
- Difficulty.
- Available eligible questions.

When generating a random paper:

- Respect the cross-category reuse rule.
- Do not select the same question twice in one paper.
- Verify sufficient eligible questions exist.
- Show a meaningful error if the pool is insufficient.
- Make the final selected question set persistent.

Once a paper is saved, its question selection must remain stable.

Refreshing or reopening the paper must not silently generate a different selection.

If regeneration is requested, clearly explain that the existing selection will be replaced and obtain confirmation.

## D. Individual question marks

Allow faculty to manually enter marks for every question.

For example:

- Question 1: 2 marks.
- Question 2: 5 marks.
- Question 3: 10 marks.

Display the calculated total:

`Total Marks = Sum of Individual Question Marks`

Validate:

- Marks are numeric.
- Marks are within permitted limits.
- No invalid negative values.
- Required questions have marks.
- Paper total is accurate.

Do not overwrite existing question-bank marks unexpectedly.

Distinguish between default question-bank marks and paper-specific marks where the current model permits that separation.

## E. Question paper preview

Provide a clean preview before saving/publishing.

Show:

- Institution/CIRA header where appropriate.
- Paper title.
- Subject.
- Class.
- Instructions.
- Question numbering.
- Question content.
- Images.
- Marks per question.
- Total marks.
- Page-friendly layout.

Ensure image questions render correctly.

## F. Download question paper

Allow faculty to download the complete generated paper.

At minimum, provide a well-formatted PDF.

Use an existing PDF-generation or print architecture if one is already available.

If none exists, select a maintained frontend-compatible approach that does not conflict with project dependencies.

The downloaded paper must include:

- All questions.
- All images.
- All question numbering.
- Individual question marks.
- Total marks.
- Relevant class and subject details.

Provide a print-friendly version as appropriate.

Do not expose internal answer keys in a student-facing downloadable version.

Support a separate answer key export only if existing permissions and requirements allow it.

---

# 12. QUESTION PAPER CLASS MANAGEMENT AND PUBLICATION

After creation, the faculty must be able to manage and publish the question paper for the selected class.

## Paper lifecycle

Provide clear states such as:

- Draft.
- Ready to Publish.
- Published.
- Closed or Completed, if supported.

Do not invent incompatible assessment states. Map to existing status conventions where possible.

## Management capabilities

Faculty should be able to:

- View created papers.
- Edit eligible drafts.
- Preview papers.
- Download papers.
- Select the intended class.
- Review paper details.
- Publish.
- See publication status.
- View associated student submissions or attempts through the existing workflow.

## Publication safeguards

Before publishing, show confirmation:

- Paper title.
- Selected class.
- Number of questions.
- Total marks.
- Assessment category.
- Applicable schedule/details.

Verify the faculty is authorized to publish for the selected class.

Publishing must persist through the backend and be reflected in the existing student assessment experience.

Do not implement a separate student assessment submission system.

Do not publish a paper accidentally due to a UI state change.

---

# 13. AI AGENTS MUST NOT SUBMIT ASSESSMENTS ON BEHALF OF STUDENTS

This is a security and assessment-integrity requirement.

AI assistants and automated service agents must not receive the ability to submit assessments on behalf of students.

## Required security model

Inspect the existing assessment submission flow.

Enforce the following server-side rules:

1. Only an authenticated student identity may submit that student's own assessment attempt.
2. The authenticated student ID must match the student associated with the attempt.
3. Faculty accounts cannot submit student assessment attempts.
4. AI-service identities and backend service accounts cannot submit student attempts.
5. Internal AI generation endpoints must not expose assessment-submission capabilities.
6. No AI agent should be able to impersonate a student through a privileged service token.
7. Submission ownership and authorization must be validated on every request.

Do not rely on hiding submission buttons in the frontend.

Do not trust client-supplied student IDs without verifying them against the authenticated principal and attempt ownership.

Retain existing legitimate AI assistance functionality that does not submit assessments.

Add tests for unauthorized submission attempts.

**Important limitation:** Do not claim that a platform can identify every possible automated action performed through a student's already-authenticated browser session. Enforce the platform's authenticated-role and ownership boundaries, prohibit privileged AI/service submission paths, and document any additional human-interaction attestation requirement separately.

---

# 14. REMOVE DEPARTMENT ENROLLMENT FROM THE FACULTY DASHBOARD

## Requirement

Department Enrollment functionality must no longer be available within the Faculty Dashboard.

## Required actions

- Inspect the faculty route and sidebar.
- Remove the Department Enrollment navigation entry.
- Remove faculty-facing links and duplicate entry points.
- Prevent unauthorized direct navigation to the faculty enrollment screen.
- Redirect to an appropriate faculty destination or show an access-denied state.

## Important preservation rule

Do not delete the underlying enrollment data.

Do not remove administrator enrollment capabilities.

Do not remove backend enrollment APIs if they are used by other roles.

Do not break Student or Admin dashboards.

Only remove the functionality from the Faculty role.

---

# 15. FACULTY PROFILE – READ-ONLY EXCEPT PASSWORD CHANGE

## Requirement

Faculty profiles must be locked so that faculty members cannot modify personal or administrative profile fields.

The only permitted self-service change is password change.

## UI changes

Inspect `UserProfile.tsx` or the actual faculty profile implementation.

Make all other profile data read-only.

Disable or remove editing controls for:

- Faculty name.
- Email.
- Department.
- Designation.
- Role.
- Approval state.
- Other administrative fields.

Show the existing profile information clearly.

Retain only a Password Change action.

## Password change workflow

Implement a secure password-change interface using the existing authentication system.

Requirements:

- Current password verification where supported.
- New password field.
- Confirm new password.
- Password strength requirements consistent with the existing authentication system.
- Clear validation errors.
- Secure submission.
- Success and failure messages.
- Avoid exposing password values in logs or responses.

If authentication is managed by an external identity provider, use its appropriate password-management mechanism.

Do not store or expose raw passwords.

Do not allow faculty to alter account role, email, approval state or administrative profile attributes.

## Acceptance criteria

- Faculty cannot edit locked profile fields through the UI.
- Direct API attempts to update protected fields remain unauthorized.
- Password change works through the supported authentication provider.
- Other roles' profile behaviour remains unaffected.

---

# 16. FACULTY STUDENT MANAGEMENT

## Requirement

Faculty should be able to view and manage students belonging to classes assigned to them.

## A. Student directory

Create or improve the Faculty Students section.

Display:

- Student name.
- Roll number.
- Department.
- Year.
- Section.

Other useful fields may be shown only when already available and authorized.

Use a polished, searchable and paginated interface.

Provide filters for:

- Year.
- Department.
- Section.

Include:

- Student profile navigation.
- Empty states.
- Loading indicators.
- API error states.
- Clear active filter indicators.

## B. Student scoping

Faculty must only view students enrolled in their assigned classes.

Apply the rule to every student-management operation:

- List students.
- Search students.
- Filter students.
- View student profiles.
- View reports.
- View performance records.
- Initiate password reset.

The backend must derive the faculty identity from authenticated credentials and enforce the class-assignment relationship.

Do not trust a client-supplied faculty ID, class ID, section ID or student ID.

Changing URL parameters must not expose unrelated records.

## C. Secure student password reset

Faculty should be able to initiate password resets only for students belonging to their assigned classes.

Inspect the existing authentication provider and reset workflow before implementing.

Preferred approach:

- Faculty selects an authorized student.
- Faculty chooses Reset Password.
- System confirms the action.
- Server verifies faculty authorization and student-class relationship.
- System triggers the supported password-reset flow through the authentication provider.
- Student receives a secure password-reset mechanism.

Do not display a student's existing password.

Do not store passwords in plaintext.

Do not expose authentication-provider administrator credentials in frontend code.

Do not allow faculty to reset passwords for students outside their assigned classes.

Use an audit log or existing security event mechanism if available.

## Acceptance criteria

- Faculty sees only assigned-class students.
- Student fields display correctly.
- Search and filters work.
- Student profiles open correctly.
- Authorized password reset works.
- Unauthorized reset requests are rejected server-side.
- Student privacy is preserved.

---

# 17. REMOVE UNNECESSARY UI AND ANIMATIONS

The platform should remain professional, fast and easy to use.

Evaluate every screen for:

- Redundant buttons.
- Duplicate navigation.
- Unnecessary decorative icons.
- Excessive shadows.
- Excessive gradients.
- Large empty containers.
- Repeated metadata.
- Overly complicated cards.
- Unnecessary animations.
- Excessive motion on hover.
- Unnecessary rendering.
- Duplicate API requests.

Retain meaningful interactions.

Use subtle transitions where they improve feedback.

Respect reduced-motion preferences.

Do not remove loading animations or indicators that provide necessary feedback.

---

# 18. PRESERVE ALL EXISTING LOADING INDICATORS

This is a non-negotiable requirement.

Retain and improve loading states across:

- Student Reports.
- Student search.
- Year/Department/Section filters.
- Question Bank.
- Question uploads.
- Question-paper generation.
- Paper publishing.
- Poll creation.
- Notifications.
- Student directory.
- Password reset.
- Student profiles.
- Assessment history.

Use:

- Skeleton loaders.
- Button loading states.
- Upload progress.
- Chart placeholders.
- Empty states.
- Error states.
- Retry actions.

Do not allow repeated clicks to create duplicate submissions or mutations.

Do not show stale data under newly selected filters without indicating loading.

An error must not be interpreted as an empty result.

---

# 19. VISUAL AND RESPONSIVE DESIGN REQUIREMENTS

Preserve CIRA's existing cream-and-maroon design language and the visual richness of the Student Dashboard.

Use existing reusable styles, typography and components where possible.

Improve:

- Sidebar.
- Header.
- Tables.
- Filters.
- Cards.
- Question Bank interface.
- Question editor.
- Question paper preview.
- Poll creation.
- Student directory.
- Student academic profile.
- Notifications.
- Faculty profile.

Avoid creating a new independent design system.

## Required test viewports

Test all newly introduced functionality and major modified screens at:

| Device | Width |
|---|---:|
| Mobile | 375px |
| Large mobile | 430px |
| Tablet | 768px |
| Laptop | 1024px |
| Desktop | 1440px |

Verify:

- Sidebar and navigation.
- Tables.
- Search and filters.
- Dialogs.
- Forms.
- Question editors.
- Charts.
- Image questions.
- Question-paper preview.
- Download behaviour.
- Poll editor.
- Student profile.
- Notification centre.

No clipped controls, unreadable charts or unusable tables.

---

# 20. DATABASE AND BACKEND IMPLEMENTATION RULES

Before making schema or API changes:

1. Inspect existing models.
2. Inspect existing endpoints.
3. Identify reusable relationships.
4. Confirm ownership and authorization boundaries.
5. Determine the minimal required changes.

Where database changes are unavoidable:

- Prefer additive migrations.
- Preserve existing records.
- Avoid destructive column removal.
- Avoid renaming fields without a compatibility plan.
- Avoid resetting the database.
- Never run production-destructive commands.
- Validate schema and migration behaviour in a safe development environment.

Where APIs are extended:

- Follow existing route naming.
- Use existing authentication middleware.
- Validate inputs.
- Check authorization on the server.
- Use transactions for multi-step persistent operations.
- Handle errors consistently.
- Avoid exposing sensitive student data.
- Add pagination for potentially large records.

Do not modify unrelated APIs.

---

# 21. TESTING REQUIREMENTS

Add tests using the testing framework already present in the repository.

Inspect available scripts before selecting commands.

## Faculty email tests

- Valid institutional email.
- Invalid external domain.
- Invalid email format.
- Similar-looking malicious domain.
- Direct API rejection.

## Reports tests

- Year filter.
- Department filter.
- Section filter.
- Cascading filter behaviour.
- Faculty assigned-class scope.
- Unauthorized student exclusion.
- Search and profile navigation.
- Loading and error states.

## Notification tests

- Load notifications.
- Read notification.
- Unread count update.
- Persistence after refresh.
- Unauthorized access.

## Poll tests

- Poll creation.
- Option validation.
- Targeting.
- Publication.
- Response persistence.
- Result aggregation.
- Unauthorized faculty access.

## Question Bank tests

- Create/edit/delete authorized questions.
- Categories and tags.
- Assignment/test separation.
- All existing question types.
- Image upload and rendering.
- Question ownership.
- Question reuse override.

## Question paper tests

- Manual question selection.
- Randomized question selection.
- No accidental duplicate questions.
- Cross-category exclusions.
- Explicit reuse.
- Marks calculation.
- Total validation.
- Stable saved paper.
- Download output.
- Class targeting.
- Publishing authorization.

## Assessment submission security tests

- Student can submit their own attempt.
- Student cannot submit another student's attempt.
- Faculty cannot submit a student attempt.
- AI/service identity cannot use privileged submission paths.
- Unauthorized API requests are rejected.

## Student management tests

- Assigned-class student list.
- Search and filters.
- Student profile access.
- Authorized password reset.
- Unauthorized password reset rejection.

## Faculty profile tests

- Profile fields are read-only.
- Protected profile API changes are rejected.
- Password-change workflow works.

## Regression tests

Verify existing:

- Student Dashboard.
- Faculty Dashboard.
- Admin Dashboard.
- Faculty approval.
- Quiz creation and evaluation.
- Assignment management.
- Submission tracking.
- Grading.
- Reports.
- Announcements.
- Surveys.
- Calendar and tasks.

---

# 22. PHASE-WISE IMPLEMENTATION ORDER

Implement in the following sequence.

## Phase 0 – Repository Audit and Baseline

- Inspect architecture.
- Map existing implementations.
- Verify current APIs and schemas.
- Identify existing functionality.
- Record Git working-tree state.
- Create baseline documentation.

## Phase 1 – Faculty Authentication and Access Rules

- Institutional email validation.
- Faculty profile locking.
- Student scoping at the authorization layer.
- Secure assessment submission restrictions.
- Secure student password reset design.

Complete security foundations before relying on the new student-management interfaces.

## Phase 2 – Student Reports and Student Management

- Year filter.
- Department filter.
- Section filter.
- Faculty-specific student listing.
- Student directory.
- Student profile navigation.
- Student password reset interface.
- Preserve loading indicators.

## Phase 3 – Dedicated Question Bank

- Navigation.
- Question listing.
- Assignment and Test/Quiz divisions.
- Categorization.
- Labels and tags.
- Question type support.
- Image questions.
- Creation and editing.
- Question usage tracking.

## Phase 4 – Question Paper Creation and Publishing

- Manual selection.
- Random question selection.
- Cross-category reuse controls.
- Individual marks.
- Total marks.
- Preview.
- Download.
- Class targeting.
- Publishing.
- Management after publication.

## Phase 5 – Announcements, Polls and Notifications

- Poll creation.
- Audience targeting.
- Publishing.
- Poll results.
- Notification bell.
- Notifications page.
- Read/unread state.
- Existing announcement functionality.

## Phase 6 – Faculty Profile and Navigation Cleanup

- Locked profile.
- Password-only self-service change.
- Remove Department Enrollment from faculty routes.
- Preserve Admin functionality.
- Improve navigation and page organization.

## Phase 7 – Responsive Design and UX Polish

- Remove unnecessary decorative UI.
- Improve form behaviour.
- Improve skeletons and error states.
- Mobile and tablet layouts.
- Accessibility.
- Performance improvements.

## Phase 8 – Full Integration, Security and Regression QA

- Full frontend testing.
- Backend authorization testing.
- Database integrity verification.
- Question-bank workflow testing.
- Student and faculty regression.
- Mobile/laptop validation.
- Documentation.
- Final implementation report.

Do not skip phases merely because a later screen is easier to implement.

Do not start later phases while earlier security foundations are incomplete.

---

# 23. IMPLEMENTATION TRACKER

Create:

`docs/faculty-upgrade/IMPLEMENTATION_TRACKER.md`

Track:

| Phase | Feature | Status | Frontend files | Backend files | Tests | Outstanding issues |
|---|---|---|---|---|---|---|

Possible statuses:

- Not Started.
- In Progress.
- Blocked.
- Completed.
- Verified.

Create:

`docs/faculty-upgrade/API_AND_DATA_DEPENDENCIES.md`

Document:

- Existing endpoints reused.
- New endpoints introduced, if needed.
- Request/response contracts.
- Authorization requirements.
- Missing information.
- Database changes.

Create:

`docs/faculty-upgrade/SECURITY_AND_REGRESSION_REPORT.md`

Document:

- Faculty authorization rules.
- Student data isolation.
- Password-reset security.
- Question ownership.
- Assessment submission restrictions.
- Regression results.
- Known limitations.

---

# 24. FINAL DEFINITION OF DONE

The implementation is complete when all of the following are true:

1. Faculty email validation accepts only `@ch.amrita.edu`.
2. Validation is enforced on both frontend and backend.
3. Notifications have a clear location and work persistently.
4. Faculty can create, target and publish polls.
5. Poll results are correctly stored and presented.
6. Student Reports include Year, Department and Section filters.
7. Report results contain only students in the faculty's assigned classes.
8. Existing loading indicators are retained.
9. Faculty has a dedicated Question Bank.
10. Assignment and Test/Quiz question pools are separate.
11. Question categorization and labels work.
12. All existing question types are supported.
13. Image-based questions work end to end.
14. Cross-category question reuse is prohibited by default.
15. Faculty can explicitly authorize question reuse.
16. Faculty can assign marks to individual paper questions.
17. Random question selection works correctly.
18. Question-paper downloads are complete and correctly formatted.
19. Faculty can manage and publish question papers for authorized classes.
20. AI/service identities cannot submit student assessment attempts through privileged platform interfaces.
21. Department Enrollment is removed from the Faculty Dashboard only.
22. Faculty profile fields are read-only except for password changes.
23. Faculty can see the relevant assigned-class student directory.
24. Student lists show name, roll number, department, year and section.
25. Faculty can securely initiate password resets for authorized students.
26. Unauthorized student access and password resets are rejected server-side.
27. Loading, empty, error and success states work correctly.
28. New features work at mobile and laptop breakpoints.
29. Student, Faculty and Admin existing functionality has been regression-tested.
30. The build and relevant test results are documented.

---

# 25. FINAL EXECUTION INSTRUCTION

Begin now.

First inspect the repository and current Git branch.

Create the baseline audit.

Then implement the work phase by phase.

Do not merely produce a plan.

Do not replace existing working functionality with mock interfaces.

Do not claim functionality is complete if its API or persistence is not implemented.

Do not expose student data outside faculty authorization.

Do not implement unsafe password reset mechanisms.

Do not allow AI agents or service accounts to submit assessments as students.

Do not run destructive database or Git commands.

At the completion of each phase:

- List files modified.
- Explain the implementation.
- List tests actually executed.
- State their results.
- Identify outstanding dependencies.
- Update the implementation tracker.

At the end, provide a complete report of all implemented features, security controls, database/API changes, responsive test results, regression results and remaining limitations.

**The priority is a secure, fully functional CIRA Faculty Workspace—not merely a visually attractive interface.**
