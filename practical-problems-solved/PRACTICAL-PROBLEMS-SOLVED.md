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

| Status | Meaning |
|---|---|
| `Open` | Not started |
| `In progress` | Branch created, work underway |
| `In review` | PR opened, waiting for review |
| `Done` | Merged, resolution documented |

### Definition of done (applies to every ticket)

- [ ] All acceptance criteria are covered by automated tests
- [ ] Lint, typecheck, and the full test suite pass in CI
- [ ] No unrelated changes in the PR
- [ ] The Resolution section is filled in
- [ ] The index table is updated

---

## Ticket index

| ID | Title | Area | Severity | Week | Status | PR |
|---|---|---|---|---|---|---|
| [TICKET-001](#ticket-001-inconsistent-bus-status-under-concurrent-updates) | Inconsistent bus status under concurrent updates | Buses, Auth | High | 1 | In progress | n/a |

---

## Ticket template

Copy this block to add a new ticket, and add a row to the index.

```markdown
## TICKET-XXX: Short descriptive title

| Field | Value |
|---|---|
| Area | e.g. Trips, Tickets, Crew |
| Severity | Low / Medium / High / Critical |
| Type | Bug / Feature / Security / Performance |
| Week | N |
| Status | Open |

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

| Field | Value |
|---|---|
| Area | Buses, Auth |
| Severity | High |
| Type | Bug and Security |
| Week | 1 |
| Status | Open |

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

   | From | Allowed targets |
   |---|---|
   | `AVAILABLE` | `ON_ROUTE`, `MAINTENANCE`, `OUT_OF_SERVICE` |
   | `ON_ROUTE` | `AVAILABLE` |
   | `MAINTENANCE` | `AVAILABLE`, `OUT_OF_SERVICE` |
   | `OUT_OF_SERVICE` | `AVAILABLE`, `MAINTENANCE` |

   Any other transition returns `409 Conflict` with a clear message.
3. **`reason` is required** when the target is `MAINTENANCE` or `OUT_OF_SERVICE` (`400` otherwise).
4. **Atomic history:** every successful change updates the bus **and** creates a `BusStatusHistory` row (`fromStatus`, `toStatus`, `changedById` taken from the JWT). Either both are saved or neither.
5. **Concurrency:** if two simultaneous requests start from the same status, only one wins. The other receives `409`, and the history must never show a transition that did not actually happen.
6. **Deactivated users** (`isActive = false`) cannot operate, **even if their JWT has not expired**.

### Acceptance criteria

Write these with Jest and Supertest.

- [x] A `DRIVER` receives `403`
- [x] A request without a token receives `401`
- [ ] A deactivated user with a valid token receives `401`
- [x] `ON_ROUTE → MAINTENANCE` returns `409`
- [x] `AVAILABLE → MAINTENANCE` without `reason` returns `400`
- [ ] A valid change leaves exactly **one** history row with the correct `changedById`
- [ ] If the history write fails, the bus status is **not** changed (force the failure with a mock)
- [ ] **Key test:** fire two requests with `Promise.all` against the same `AVAILABLE` bus (one to `MAINTENANCE`, one to `ON_ROUTE`). Exactly one responds `200`, the other `409`, and the history has **one** row
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

> reason is validated only at the DTO boundary; mutation showed the service accepts it without the pipe. Accepted for now; move to domain rules when a non-HTTP caller appears.

**Approach:**

**Trade-offs considered:**

**Tests added:**

**What I learned:**

**PR:**