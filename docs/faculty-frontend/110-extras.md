# Faculty Frontend Phase 11: Productivity Extras

## Scope

Phase 11 is frontend-only. Existing API routes, payloads, backend services, Prisma, and the AI service were not changed.

## Draft autosave

The quiz editor, assignment editor, and announcement composer save explicit form fields to local storage after a 500 ms debounce.

Storage keys follow:

```text
cira:faculty:draft:<user-id-or-email>:<form>:<record-id>
```

Forms are `quiz`, `assignment`, and `announcement`. New records use `new`; edits use the existing record ID. Rich text is persisted as editor HTML, restored into the existing TipTap editors, and sanitized by the existing render paths. A restored draft displays a **Restored draft from this device** notice with a Discard action. Successful submissions clear the matching draft. Failed submissions leave the current input and show action feedback.

Storage failures and quota errors are intentionally best effort: the editor continues to work without persistence.

## Saved filters

Saved filter keys follow:

```text
cira:faculty:filters:<user-id-or-email>:<screen>
```

Current screens:

- `reports`: batch, department, section, and quiz IDs.
- `quizzes`: list search text.
- `assignments`: list search text.
- `announcements`: search text and survey-only filter.

Each screen has a Reset filters control. Report selections are dropped when the corresponding API reference data no longer contains the saved ID.

## CSV export and print views

CSV generation is centralized in [`frontend-web/src/lib/csv.ts`](../../frontend-web/src/lib/csv.ts). It:

- Escapes quotes, commas, and newlines.
- Prefixes cells beginning with `=`, `+`, `-`, or `@` to prevent spreadsheet formula execution.
- Uses explicit columns for the supported exports.

Exports:

- Reports performance-band data from returned `yearData` and `deptData` fields.
- Assignment submission roster using returned student, status, grade, and feedback fields.
- Quiz attempts using returned student, roll number, score, status, and violation fields.

Filenames include the relevant screen/record/filter context and the current export date. Report, assignment roster, and quiz-attempt views include print controls and print-friendly CSS.

## Command palette

Faculty can open the command palette with:

- `Ctrl+K` on Windows/Linux.
- `Cmd+K` on macOS.
- The responsive header search button, including touch/mobile layouts.

The palette uses the Phase 1 `AccessibleDialog`, supports Escape, focus containment/restoration, arrow-key navigation, Enter selection, and a labelled listbox/combobox relationship. It searches verified faculty destinations and lazily loads quiz, assignment, and announcement list data through [`apiClient`](../../frontend-web/src/lib/apiClient.ts). Each lazy source has its own loading/error/retry state. Selecting a result navigates to the existing component-state Faculty screen; announcement results return to Overview because there is no separate verified announcement route.

The trigger and shortcut are opt-in to the Faculty shell. Student and Admin defaults are unchanged.

## Today agenda

The Overview agenda combines:

- Open tasks from `/api/v1/faculty/dashboard/tasks`.
- Calendar events from `/api/v1/faculty/dashboard/calendar`.
- Assignment records from `/api/v1/assignments/faculty`.

Items are sorted by date and grouped as Today, Tomorrow, and This week. Task and calendar items link to Overview; assignment items link to Assignments. Each source retains independent loading/error/empty behavior, so one failed request does not become zero data or hide other sources.

The agenda only creates assignment items when the returned assignment object contains a usable `dueDate`, `dueAt`, or `deadline` string. The current frontend contract does not assume that assignment responses contain a due-date field; when none is present, assignment due dates are omitted and the panel says that the response has no due-date field.

## Tests and validation

Added focused tests for:

- Draft save/restore/clear and unavailable storage.
- Saved-filter scoping and stale IDs.
- CSV escaping and formula neutralization.
- Command palette keyboard navigation and Escape.
- Agenda rendering when the task source fails.

The final Phase 11 validation is recorded in the handover response and should be repeated after any API contract change.

## Known limitations

- Faculty navigation remains component-state based, so palette selection does not create deep links.
- Command-palette lists are fetched with bounded first-page requests and do not replace the management screens’ pagination.
- Local storage is device/browser scoped and is not synchronized across devices.
- Existing TipTap duplicate-extension warnings in legacy editors remain outside this phase.
