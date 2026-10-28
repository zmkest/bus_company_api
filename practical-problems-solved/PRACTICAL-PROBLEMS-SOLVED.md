# Weekly Engineering Tickets

A living log of realistic backend problems for the **Bus Company** project (NestJS + Prisma + PostgreSQL). Each week I take one ticket, solve it, test it, and document what I learned.

The goal is to practice the situations that separate a CRUD demo from a production system: concurrency, data integrity, security, and testing.

---

## Table of contents

- [How it works](#how-it-works)
- [Ticket index](#ticket-index)
- [Ticket template](#ticket-template)
- [TICKET-001: Inconsistent bus status under concurrent updates](#ticket-001-inconsistent-bus-status-under-concurrent-updates)

---

## How it works

1. **Pick** the next ticket from the index (status `Open`).
2. **Create a branch**: `ticket/001-bus-status-consistency`.
3. **Implement** the requirements and write the acceptance tests first when possible.
4. **Open a PR** with the ticket ID in the title: `fix(buses): TICKET-001 consistent status changes`.
5. **Fill in the Resolution section** of the ticket: approach, trade-offs, lessons.
6. **Update the index** with the final status and the PR link.

### Status values

| Status        | Meaning                       |
| ------------- | ----------------------------- |
| `Open`        | Not started                   |
| `In progress` | Branch created, work underway |
| `In review`   | PR opened, waiting for review |
| `Done`        | Merged, resolution documented |

### Definition of done (applies to every ticket)

- [ ] All acceptance criteria are covered by automated tests
- [ ] Lint, typecheck, and the full test suite pass in CI
- [ ] No unrelated changes in the PR
- [ ] The Resolution section is filled in
- [ ] The index table is updated

---

## Ticket index

| ID                                                                         | Title                                            | Area        | Severity | Week | Status      | PR  |
| -------------------------------------------------------------------------- | ------------------------------------------------ | ----------- | -------- | ---- | ----------- | --- |
| [TICKET-001](#ticket-001-inconsistent-bus-status-under-concurrent-updates) | Inconsistent bus status under concurrent updates | Buses, Auth | High     | 1    | In progress | n/a |

---

## Ticket template

Copy this block to add a new ticket, and add a row to the index.

```markdown
## TICKET-XXX: Short descriptive title

| Field    | Value                                  |
| -------- | -------------------------------------- |
| Area     | e.g. Trips, Tickets, Crew              |
| Severity | Low / Medium / High / Critical         |
| Type     | Bug / Feature / Security / Performance |
| Week     | N                                      |
| Status   | Open                                   |

### Support report

> Quote from the (fictional) user or support agent describing the symptom.

### Context

Why this matters for the business.

### Requirements

1. ...

### Acceptance criteria

- [ ] ...

### Hints

- ...

### Bonus

- ...

### Resolution

**Approach:**
**Trade-offs considered:**
**Tests added:**
**What I learned:**
**PR:**
```

---

## TICKET-001: Inconsistent bus status under concurrent updates

| Field    | Value            |
| -------- | ---------------- |
| Area     | Buses, Auth      |
| Severity | High             |
| Type     | Bug and Security |
| Week     | 1                |
| Status   | Done             |

### Support report

> "Yesterday two operators changed the same bus at almost the same time. One moved it to `MAINTENANCE` and the other to `ON_ROUTE`. The bus ended up as `ON_ROUTE`, but the history shows two changes that don't add up: `AVAILABLE → MAINTENANCE` and `AVAILABLE → ON_ROUTE`. Also, a user we deactivated on Monday kept changing statuses until today."

### Context

The bus status drives trip scheduling and seat sales. An inconsistent status can send a bus that is under maintenance onto a route, and a corrupted history makes audits and statistics unreliable. The report reveals three separate problems:

1. A **race condition** between reading and writing the bus status.
2. A **missing transition rule set**, so any status can follow any other.
3. A **deactivated user** whose JWT is still accepted.

### Requirements

Implement `PATCH /buses/:id/status` with body `{ "status": "...", "reason": "..." }`.

1. **Authorization:** only `ADMIN` and `OPERATOR` can use it.
2. **Valid transitions only:**

   | From             | Allowed targets                             |
   | ---------------- | ------------------------------------------- |
   | `AVAILABLE`      | `ON_ROUTE`, `MAINTENANCE`, `OUT_OF_SERVICE` |
   | `ON_ROUTE`       | `AVAILABLE`                                 |
   | `MAINTENANCE`    | `AVAILABLE`, `OUT_OF_SERVICE`               |
   | `OUT_OF_SERVICE` | `AVAILABLE`, `MAINTENANCE`                  |

   Any other transition returns `409 Conflict` with a clear message.

3. **`reason` is required** when the target is `MAINTENANCE` or `OUT_OF_SERVICE` (`400` otherwise).
4. **Atomic history:** every successful change updates the bus **and** creates a `BusStatusHistory` row (`fromStatus`, `toStatus`, `changedById` taken from the JWT). Either both are saved or neither.
5. **Concurrency:** if two simultaneous requests start from the same status, only one wins. The other receives `409`, and the history must never show a transition that did not actually happen.
6. **Deactivated users** (`isActive = false`) cannot operate, **even if their JWT has not expired**.

### Acceptance criteria

Write these with Jest and Supertest.

- [x] A `DRIVER` receives `403`
- [x] A request without a token receives `401`
- [x] A deactivated user with a valid token receives `401`
- [x] `ON_ROUTE → MAINTENANCE` returns `409`
- [x] `AVAILABLE → MAINTENANCE` without `reason` returns `400`
- [x] A valid change leaves exactly **one** history row with the correct `changedById`
- [x] If the history write fails, the bus status is **not** changed (force the failure with a mock)
- [x] **Key test:** fire two requests with `Promise.all` against the same `AVAILABLE` bus (one to `MAINTENANCE`, one to `ON_ROUTE`). Exactly one responds `200`, the other `409`, and the history has **one** row
- [x] The transition table is covered by unit tests that do not touch the database

### Hints

- Think about what happens between `findUnique` and `update` when two requests interleave. What does Prisma guarantee there?
- There are at least two valid approaches for requirement 5. Choose one and justify it in two lines in the Resolution section.
- For requirement 6, check what your `JwtStrategy` validates today and where it gets the user from.
- Look at `prisma.$transaction` and what `updateMany` returns when nothing matches.

### Bonus

- [ ] Move the transition table to `packages/contracts` so Angular can reuse it and hide invalid actions in the UI
- [ ] Add a paginated `GET /buses/:id/status-history`

### Resolution

**Approach:**

- Transition rules live in a pure function `canTransition(from, to)` backed by
  `BUS_STATUS_TRANSITIONS` (`bus-status.rules.ts`). The service maps a rejected
  transition to `409 Conflict`.
- Concurrency uses optimistic locking: inside a `$transaction`, the bus is updated
  with `updateMany({ where: { id, status: currentStatus } })`. If `count === 0`,
  another request changed the status first, so the service throws `409` and the
  history row is never written.
  _Why optimistic and not a row lock (`SELECT ... FOR UPDATE`):_ TODO (2 lines, in my words).
- `reason` is validated in `UpdateBusStatusDto` with `@ValidateIf` and trimmed,
  so blank values are rejected.
- `AuthGuard` verifies the JWT signature and loads the user with
  `findActiveById`. Deleted or deactivated users get `401`, and the role comes
  from the database, not from the token.
- `CurrentUserId` fails closed: a missing or invalid user id returns `401`.

**Requirement changes:**

- Added `OUT_OF_SERVICE → AVAILABLE` (a bus can be out of service for reasons
  that don't need maintenance, such as fines or driver issues).
- Changing to `MAINTENANCE` also opens a `Maintenance` record (`type`, `startedAt`).
  Scope added beyond the original ticket.

**Decisions:**

- Same-status transitions (e.g. `AVAILABLE → AVAILABLE`) return `409`.
- DTO validation runs before the service: `ON_ROUTE → MAINTENANCE` without
  `reason` returns `400`, not `409`.
- Guards run before pipes: a `DRIVER` with an invalid payload gets `403`, not `400`.
- The user is loaded from the database on every authenticated request, so
  deactivation and role changes apply immediately. Cost: one query per request.

**Findings during the work:**

- `@Type(() => Date)` accepted `'1102'` as a valid date (year 1102). Fixed.
- `reason` is enforced only at the DTO boundary; a mutation test showed the
  service accepts a missing reason without the `ValidationPipe`. Accepted for
  now; move to domain rules when a non-HTTP caller appears.
- Without `AuthGuard`, `CurrentUserId` crashed with a `500`. Fixed to fail closed.
- `AuthGuard` swallowed every error as `401` (including database failures) and
  trusted the role in the token. Fixed.
- The trigger to force an error survives if it is not deleted within a `finally`, which does not work within a `catch`.

**Tests added:**

- Unit: all 50 status transition combinations (no database).
- Unit: `BusesService` happy path, not found, invalid transition, lost race.
- Unit: `UpdateBusStatusDto` validation rules.
- E2E: missing reason (400), no token / malformed / tampered token (401),
  `DRIVER` (403), `DRIVER` with invalid payload (403).
- E2E: TODO history row, rollback, deactivated user, concurrency.
- E2E: deactivated user with a still-valid token (401).
- E2E: rolls back the bus change when the history insert fails.
- E2E: Multiple requests and only one will win while the others only return 409.

**What I learned:**

- A passing test isn't proof: mutation testing exposed tests that passed for the
  wrong reason.
- Prisma queries without `await` never run.
- Migrating and cleaning the test database are different operations with very
  different costs.
- TODO: add what concurrency testing taught me.
- Apply mutations before each test to check for different types of errors or validations.
- The error is caused in a `try`and not caught by `catch` , all the error is printed on console.

**PR:** TODO
