\# AGENTS.md



\## Project

SOPALOHA is an internal local-first support console for Aloha POS environments.

It is not a public SaaS.

The app is operationally critical for daily technical support work.



\## Tech stack

\- Monorepo Node.js

\- apps/web: React + Vite

\- apps/api: Node.js + Express

\- Database: SQLite

\- Main use case: internal support operations for stores, devices, incidents, tasks, notes, TeamViewer imports/explorer, and on-call shifts



\## Product context

This system is used to:

\- centralize store technical records

\- manage devices per store

\- document incidents and solutions

\- manage operational tasks

\- keep technical notes

\- work with TeamViewer imports/groups/devices/cases

\- manage on-call rotations and current shift visibility



\## Critical modules

Treat these as high priority and high risk:

1\. authentication

2\. authorization / roles

3\. stores / locals

4\. devices

5\. incidents

6\. tasks

7\. on-call / guards

8\. TeamViewer integration

9\. SQLite migrations

10\. backup/restore related logic if present



\## Engineering priorities

Optimize for:

1\. reliability

2\. testability

3\. minimal regressions

4\. small safe changes

5\. maintainability

6\. no overengineering



\## Rules for changes

\- Do not rewrite the architecture unless explicitly asked

\- Prefer minimal, reviewable changes

\- Keep backwards compatibility with existing installations whenever possible

\- If a DB schema change is needed, add a migration and a migration test

\- Do not remove existing behavior unless explicitly instructed

\- Do not add complex infrastructure

\- Do not introduce Kubernetes, Docker rewrites, microservices, or distributed systems patterns

\- Keep the app local-first



\## Testing strategy

Prefer this order:

1\. integration tests for API + SQLite

2\. auth and role tests

3\. migration tests

4\. smoke tests

5\. frontend tests for critical user flows

6\. TeamViewer integration tests using mocks/fakes

7\. unit tests only where logic is non-trivial



Avoid low-value cosmetic tests.



\## Production safety

\- Never use the real production database in automated tests

\- Use temporary SQLite databases for tests

\- Mock external integrations when possible

\- Avoid destructive operations in test environments unless clearly isolated

\- Protect current operational workflows



\## When implementing

For every task:

1\. explain the plan briefly

2\. list files to change

3\. implement the smallest useful version

4\. run relevant checks/tests

5\. summarize what changed

6\. note risks or follow-up items



\## Code style

\- Keep functions focused

\- Prefer explicit naming over clever abstractions

\- Favor readability over premature abstraction

\- Add comments only when they clarify intent

\- Keep logs useful for support/debugging



\## CI/CD expectations

If asked to add CI:

\- keep it simple

\- install dependencies

\- lint

\- build

\- run tests

\- run smoke checks

\- fail fast on critical issues



\## Important project-specific constraints

\- This is an internal support console for real operational use

\- A broken release is more expensive than slower development

\- TeamViewer-related code must degrade gracefully on upstream failures

\- SQLite locking / migration / compatibility issues are important risks

\- Auth and role regressions are release blockers

