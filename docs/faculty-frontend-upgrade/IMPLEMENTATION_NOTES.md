# Faculty Frontend Upgrade Notes

## Architectural decisions

- Faculty demo data is isolated behind `FacultyDemoContext` and `facultyDemoData.ts`; live mode continues to use the existing API client.
- The shared `DashboardLayout` receives opt-in Faculty navigation/demo props so Student and Admin defaults remain unchanged.
- Existing tab-based Faculty navigation is preserved because the repository does not currently expose separate Faculty routes for every proposed destination.
- New aggregate metrics are not fabricated. Where APIs do not return a value, the UI must omit it or describe it as unavailable.
- Existing request payloads and endpoint paths are preserved.
- Local persistence is limited to form drafts and saved filters; no credentials or server records are stored.
- Existing generated documentation outside this upgrade directory is not recreated.

## Data limitations

The current frontend does not prove availability of all requested overview metrics, risk classifications, topic mastery series, multi-cohort comparisons, or activity-feed aggregates. These remain unavailable-data states unless returned by an existing response.

## Scope boundary

Do not modify `backend-core`, `backend-ai`, Prisma, FastAPI, MongoDB, PostgreSQL, or `.env` files for this work.

## Current UI refinements

- Assignment cards now display a safe due-date label (`Due`, `No date`, or `Date unavailable`) instead of formatting `createdAt` as an assignment date or exposing `Invalid Date`.
- Overview status copy is faculty-facing (`tasks available`, `events scheduled`, or `Assignment deadlines unavailable`) rather than exposing response-field diagnostics.
- Faculty desktop navigation can collapse to an icon rail through an opt-in layout prop. Mobile navigation always presents labels and remains keyboard-managed.
- Theme state is centralized in `src/context/ThemeContext.tsx`, persisted under `cira_theme`, applied before React mounts through the `index.html` bootstrap script, and exposed from the dashboard header and profile settings.
- Dark mode uses the existing semantic CSS variables plus dark surface/input overrides, so Faculty cards, editors, tables, dialogs, and authentication surfaces do not remain white against a dark background.
