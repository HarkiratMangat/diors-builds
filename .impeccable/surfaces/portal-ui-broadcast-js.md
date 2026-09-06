---
version: 1
slug: "portal-ui-broadcast-js"
primary_target: "portal/ui/broadcast.js"
related_targets: []
---

## Scope and mode

**Broadcast** — `portal/ui/broadcast.js`. Mode: **Operate**. Views: Delivery queue · Airtime.

Compose and schedule what players are told — announcements and patch notes, the two things that leave the portal and land in Discord.

## Audience and job

One admin today, a second one shortly: `models/AdminUser.js` and the per-page scopes already exist, so the realm is designed for a reader who did NOT specify it. Density is chosen, never maximal.

**The arriving state:** Something must be said, corrected, or withdrawn before players see it.

## The task, and what proves it done

Every mutation is a `core/ops` value — validate, preview, apply, invert. The realm's job is to make the preview truthful and the invert reachable; it is a driver of that algebra, never a second implementation of it.

## What must stay untouched

- **Conformance is measured, not judged.** The design authority is `docs/superpowers/mockups/2026-08-23-portal-interactive/`, and this realm closes on the ENUMERATION of cited differences, never on a percentage.
- Colour carries topic; shape carries state. A new state gets a new shape, never a new hue.
- ⚠️ Four realm accents are aliases of state colours in `tokens.css`. Whether that is a defect or a deliberate pun is recorded as undecided in DESIGN.md and must not be silently resolved here.

## Memorable moment

This is the realm where a mistake is public. Preview is not a convenience here; it is the last surface before an audience.

## Unresolved

Carried from `docs/superpowers/plans/2026-09-05-portal-interactive-surface.md`; do not re-derive these, and do not close them without Harkirat.

*Written 2026-09-06 00:28 EDT — the first surface briefs this project has had. Every impeccable command reads one to pick its standard; without them each run re-inferred the mode from code, which the docs name as the main source of generic advice.*
