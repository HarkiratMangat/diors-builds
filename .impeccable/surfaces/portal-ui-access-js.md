---
version: 1
slug: "portal-ui-access-js"
primary_target: "portal/ui/access.js"
related_targets: []
---

## Scope and mode

**Access** — `portal/ui/access.js`. Mode: **Operate**. Views: By admin · By permission.

Grant, scope, and revoke a second admin's reach, page by page, through the permission matrix `hasManagePageAccess` reads.

## Audience and job

One admin today, a second one shortly: `models/AdminUser.js` and the per-page scopes already exist, so the realm is designed for a reader who did NOT specify it. Density is chosen, never maximal.

**The arriving state:** Someone needs access, or should stop having it.

## The task, and what proves it done

Every mutation is a `core/ops` value — validate, preview, apply, invert. The realm's job is to make the preview truthful and the invert reachable; it is a driver of that algebra, never a second implementation of it.

## What must stay untouched

- **Conformance is measured, not judged.** The design authority is `docs/superpowers/mockups/2026-08-23-portal-interactive/`, and this realm closes on the ENUMERATION of cited differences, never on a percentage.
- Colour carries topic; shape carries state. A new state gets a new shape, never a new hue.
- ⚠️ Four realm accents are aliases of state colours in `tokens.css`. Whether that is a defect or a deliberate pun is recorded as undecided in DESIGN.md and must not be silently resolved here.

## Memorable moment

The matrix IS the design: a grid where the intersection is the fact. ⚠️ Granting is currently by typed Discord ID with no lookup — pin 32, unresolved, and a real safety gap rather than a styling one.

## Unresolved

Carried from `docs/superpowers/plans/2026-09-05-portal-interactive-surface.md`; do not re-derive these, and do not close them without Harkirat.

*Written 2026-09-06 00:28 EDT — the first surface briefs this project has had. Every impeccable command reads one to pick its standard; without them each run re-inferred the mode from code, which the docs name as the main source of generic advice.*
