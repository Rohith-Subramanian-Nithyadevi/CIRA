# Part 8 – Supplement for the Revised Faculty Frontend Brief

## Purpose

This supplement fills the gaps left by the overlapping Parts 1–7 brief material. It defines the transfer matrix from Student Dashboard patterns to Faculty equivalents, complete chart specifications, table/form/responsive plans, and the consolidated backend dependencies that remain outside a frontend-only implementation.

Student-audit findings are marked `[BRIEF]` where they depend on the Student Dashboard UI/UX audit. The audit source was not attached to this supplement; those findings should be re-verified against the repository before implementation.

## 8.1 Phase numbering map

| Revised brief | This suite | Note |
|---|---:|---|
| P0–P3 | 0–3 | Same phase mapping. |
| P4 Student & cohort UI | 5 | Student/cohort UI phase. |
| P5 Quiz/question bank | 7 | Quiz and question-bank workflows. |
| P6 Assignments/grading | 8 | Assignment and grading workflows. |
| P7 Analytics | 6 | Built after Phase 5 because it reuses the selector hook. |
| P8 Calendar/notifications/productivity | 4 and 11 | Phase 11 contains autosave, saved filters, CSV export, command palette, and Today agenda. |
| P9, P10 | 9, 10 | Same mapping. |

The order differs only to account for data dependency. It can be renumbered to match the revised brief if required.

## 8.2 Feature-transfer matrix

Codes:

1. Reuse directly.
2. Reuse with adaptation.
3. Build a Faculty equivalent.
4. Not appropriate for Faculty.
5. Verify in the repository before implementation.

| Student pattern | Code | Faculty use |
|---|---:|---|
| `DashboardLayout`, `ProtectedRoute`, `EmptyState`, theme tokens | 1 | Use the existing shared infrastructure. Faculty may opt into responsive/grouped navigation props; Student/Admin defaults must remain unchanged. |
| `UserProfile` | 5 | Verify whether its content is role-neutral or contains student-only fields. |
| SVG progress ring | 2 | Use for completion rings only when attempt or submission counts exist. |
| Topic/goal progress bars and status badges | 2 | Adapt for band share, graded/submitted progress, and quiz/assignment status. |
| Student Analytics chart cards, tooltips, and palette | 2 | Reuse shapes and palette only. Do not copy demo data. |
| Area chart for score progression | 2 | Use for cohort/student trends only when a time series is returned. |
| Bar score distribution | 2 | Use for performance bands when the endpoint supplies the required data. |
| Radar topic chart | 5 | Use only if topic mastery data is returned for the requested Faculty scope; otherwise skip. |
| Benchmark/reference lines | 2 | Use only with a defined benchmark, such as a returned maximum mark. Never invent targets. |
| Heatmap-style progression | 3 | Build a Faculty cohort-by-quiz grid only if the API supports the required values. |
| `TopicPerformance` rows | 2 | Adapt the expandable-row pattern for student/cohort data returned by Faculty endpoints. |
| `GoalTracker` visuals | 2 | Reuse visual treatment for assignment/quiz progress. Student goals remain out of scope. |
| `StudyPlanner` calendar/task UI | 2 | Adapt for Faculty calendar and tasks. Pomodoro and habits remain out of scope. |
| `StudentAnnouncements` cards and filters | 2 | Adapt for Faculty announcements, surveys, and composer workflows. |
| `ResourceHub` search/category controls | 2 | Reuse controls only. Curated resource content is not a Faculty feature. |
| `MistakeNotebook` expandable groups | 2 | Reuse the expand/collapse pattern only. Mistake logic is student-specific. |
| `RevisionPool` overlays and empty states | 2 | Reuse overlay/empty-state patterns only. Revision logic is student-specific. |
| `SheetView` filters and expand behavior | 2 | Adapt for quiz and roster lists. |
| `StudentSpace` greeting and hierarchy | 2 | Adapt for the Faculty overview. |
| SIS formulas, demo mode, exam-taking | 4 | Never copy these concepts. SIS values may be displayed only when an existing Faculty endpoint returns them. |

### Concept translations

| Student concept | Faculty equivalent | Constraint |
|---|---|---|
| Student progress card | Cohort performance summary | Use band data only. |
| Assessment progress | Attempt/submission completion | Use only returned counts. |
| Activity feed | Tasks, events, announcements, and assignment dates | Compose only from existing responses. |
| Goal tracking | Improvement monitoring | Unavailable without a confirmed data source. |
| Performance chart | Cohort/student performance chart | Requires a returned series or aggregate. |

## 8.3 Chart specifications

### Shared chart rules

All charts must:

- Use `ResponsiveContainer`.
- Have a minimum height of 220px.
- Move legends below the chart below 768px.
- Make tooltips usable on touch devices through tap interaction.
- Provide a text summary.
- Provide a data-table alternative for users who cannot use the chart.
- Render loading, error-with-retry, and empty states independently.
- Never render request failure as a zero-valued chart.

An API status of `verified` means the endpoint is named in the brief. Its exact fields still require repository verification where noted. An `unverified` status means Phase 0 must confirm the response before implementation.

| # | Chart | Purpose/type | Data and API source | Inspiration | Filters/interactions | Frontend-only? |
|---:|---|---|---|---|---|---|
| 1 | Performance bands | Result spread; bar or stacked bar | `/api/v1/faculty/reports/performance-bands`; endpoint verified, fields require confirmation | Student score distribution | Batch, department, section, quiz; tooltip; click band to student list only if IDs are returned | Yes |
| 2 | Quiz score distribution | Difficulty/spread; histogram | Quiz attempt/submission scores; unverified | Student score distribution | Quiz and section; tooltip | Yes, if scores are returned |
| 3 | Cohort comparison | Compare sections/batches; grouped bar | Per-cohort means from repeated band calls or report fields; unverified | Student benchmark comparison | Quiz and cohorts; legend toggle | Only if one call returns the required data; no fan-out |
| 4 | Quiz comparison | Compare quizzes for one cohort; bar | Quiz list plus results; unverified | None | Cohort; sort | Only if results are returned without unsupported fan-out |
| 5 | Completion ring | Attempted versus targeted | Attempt counts and target size; unverified | SIS ring shape only | Quiz; drill to attempts | Only if both numbers are returned |
| 6 | Submission status | Submitted/graded/pending per assignment; stacked bar or ring | `/api/v1/assignments/faculty/:assignmentId/submissions`; exact response requires verification | Progress bars | Assignment; click through to roster | Yes, one assignment at a time |
| 7 | Grading progress | Graded versus submitted; progress bar | Submission list with grade fields | GoalTracker bar | Assignment | Yes, per assignment |
| 8 | Student trend | One student's results over time; line or area | Student profile data; unverified | Student area chart | Quiz range | Only if a time series is returned |
| 9 | Topic mastery | Weak topics; bar or radar | Topic fields; unverified | Radar and `TopicPerformance` | Cohort and subject | Unknown; skip if absent |
| 10 | Improvement trajectory | Change over time | No confirmed source | None | None | No; backend dependency |
| 11 | At-risk distribution | Students needing attention | No documented rule | None | None | No; backend dependency |
| 12 | Department performance | Department comparison | Unverified | None | None | Only if returned in one call |
| 13 | Submission/grading trends | Activity over weeks; area chart | Timestamps in lists; unverified | Activity trend | Date range | Yes, client-side bucketing of returned timestamps, clearly labelled |

### Chart implementation guardrails

- Do not infer cohort means from unrelated responses.
- Do not call an endpoint repeatedly to manufacture a comparison chart where the brief prohibits fan-out.
- Do not label a derived client-side bucket as a server aggregate.
- Do not show “at risk,” “improvement,” or “benchmark” values without a documented rule or returned field.
- When a chart lacks enough data, show a truthful insufficient-data state and the supporting text/table state.

## 8.4 Tables and data management

| List | Source | Search/filter/sort | Pagination | Row actions | Notes |
|---|---|---|---|---|---|
| Students | Reports/student endpoints | Name search; cohort selectors; sort by returned fields | Client-side unless API pages; verify | Open profile, preferably preview drawer then full view | No CRUD |
| Cohorts | `/api/v1/batches`, `/api/v1/departments`, sections | Selector-based | Not applicable | Open in Reports | Summary only |
| Quizzes | `/api/v1/faculty/quiz` | Search, status chips, date/title sort | Client-side | Open, edit, publish, delete with confirmation | Existing actions only |
| Assignments | `/api/v1/assignments/faculty` | Search, status, due-date sort if a due date is returned | Client-side | Edit, delete with confirmation, open submissions | Do not invent due dates |
| Submissions/grading | Submission endpoint | Status chips, student search, sort | Client-side | Open and grade | Bulk actions are not confirmed |
| Attempts | Quiz submission routes | Search and status | Client-side | Evaluate and allow restart with confirmation | Existing actions only |

Column visibility controls apply only to submissions and attempts rosters where many columns are present.

Responsive table behavior:

- At 768px and above, use tables.
- Below 768px, use stacked cards.
- At 768–1023px, allow horizontal scrolling and keep the first column sticky where practical.
- Preserve accessible headers, labels, and row-action names in both representations.

Filter state belongs in URL query parameters where routes support them. Otherwise it remains in component state or the documented per-user saved-filter storage used by Phase 11.

## 8.5 Forms and workflows

Apply the following pattern to quiz, assignment, announcement/survey, grading, and report-filter forms:

- Use sectioned layouts with visible headings.
- Use a dialog for short forms such as events, tasks, and confirmations.
- Use a side drawer for long assignment and announcement forms where the existing shell supports it.
- Show inline field errors and a summary at the top after submit.
- Provide helper text explaining targeting and “who will see this.”
- Provide Save and Cancel actions.
- Guard dirty forms when closing if the existing workflow supports a close action.
- Show progress and disable the submit action while submitting.
- On failure, show a toast and preserve input.
- On success, show a success toast and the next available action.
- Keep payload shapes and validation rules unchanged.
- Client validation may mirror server rules but must not replace server validation.
- Sanitize TipTap content with DOMPurify on display, as the existing implementation does.

## 8.6 Responsive behavior

| Area | ≥1440px | 1024–1439px | 768–1023px | <768px |
|---|---|---|---|---|
| Shell | Full sidebar | Full sidebar | Collapsed icon rail | Drawer and top bar |
| Overview grid | Four-column KPIs; two-column panels | Three to four KPIs | Two KPIs per row | Single column; KPIs may scroll horizontally |
| Charts | Side-by-side pairs | Side-by-side pairs | Stacked | Stacked, with summary/table toggle |
| Tables | Full table | Full table | Horizontal scroll with sticky first column | Stacked cards |
| Dialogs/drawers | Centered dialog or 480–560px drawer | Same | Same | Full-screen sheet |
| Forms | Two-column sections | Two-column sections | One column | One column with sticky action bar |

Responsive acceptance checks:

- No horizontal page overflow at 375px.
- Interactive targets remain keyboard and touch accessible.
- Long labels wrap without hiding actions.
- Charts remain readable when legends move below.
- Tables expose all row actions in their stacked-card representation.

## 8.7 Shell extras

| Capability | Phase | Scope |
|---|---:|---|
| Collapsible sidebar and breadcrumbs | 2 | Use existing shell patterns; do not change Student/Admin defaults. |
| Notification center | 2 and 4 | Use existing notification endpoint and panel behavior. |
| Global search | 11 | Delivered as the Faculty command palette; searches only cached/fetched Faculty data. |
| Settings | Phase 0 verification | Omit unless an existing capability is confirmed in the repository. |

## 8.8 Out-of-scope backend dependencies

These are not mandatory frontend deliverables. They describe backend capabilities that would unlock additional widgets or analytics.

| Missing capability | Widgets/features it would unlock |
|---|---|
| Faculty KPI aggregate: assigned students, active cohorts, completed assessments | Overview KPI cards |
| Pending-grading/awaiting-grading aggregate | Grading backlog card and queue |
| Documented at-risk rule and list | At-risk indicator and chart 11 |
| Improvement delta or time series per student/cohort | Charts 8 and 10; improvement KPIs |
| Activity feed and deadlines aggregate | Richer recent-activity panel |
| Topic mastery per cohort | Chart 9 |
| Multi-cohort comparison in one call | Charts 3, 4, and 12 |
| Question-bank model, bulk grading, and rubrics | Standalone Question Bank page and bulk actions |

Frontend implementation must not simulate these missing capabilities with fabricated metrics, repeated unsupported requests, or student-only demo data. They should be recorded as dependencies and revisited only when an API contract exists.
