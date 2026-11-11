# AGENTS.md
- Work only on branch `santhosh_branch`. Run `git status` before starting. Never run git reset --hard, git clean, force push, branch switches, destructive DB commands, or edit .env files.
- Full requirements are in docs/faculty-upgrade/SPEC.md. Read only the sections named in each task.
- Inspect real code before changing anything. Reuse existing APIs, models, components, loading indicators. Additive Prisma migrations only.
- Authorization is always enforced server-side. Never trust client-supplied faculty/class/student IDs.
- Preserve the cream/maroon design system and all existing loading states.
- Implement, don't just plan. Never mock a feature that needs persistence.
- After each task: list files changed, tests actually run with results, outstanding issues. Update docs/faculty-upgrade/IMPLEMENTATION_TRACKER.md. Then stop.
- Start a new Codex thread for each task below, and commit after each one (git commit on your branch) so you can roll back a bad phase.

## Task order

| # | Task | Spec sections |
|---|---|---|
| 0 | Audit + docs scaffolding | 4, 23 |
| 1 | Security foundation | 5, 13, 15 (API side), 16B |
| 2 | Student scoping, Reports, Directory, Password reset | 8, 16 |
| 3 | Question Bank | 9, 10 |
| 4 | Question papers + publishing | 11, 12 |
| 5 | Polls | 7 |
| 6 | Notifications | 6 |
| 7 | Profile lock + nav cleanup | 14, 15 |
| 8 | UX/responsive polish | 17, 18, 19 |
| 9 | Full QA + final report | 21, 24 |

Do not start a task until the previous one builds and passes its tests.
